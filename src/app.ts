import * as express from "express";
import * as compression from "compression";
import * as bodyParser from "body-parser";
import { query, oneOf, validationResult, param } from "express-validator/check";
import { matchedData } from "express-validator/filter";
import * as shell from "shelljs";

// Derived from CLI usage string
interface AssetGeneratorParams {
    /** Apply a distance transform algorithm to the atlas. If none is chosen, no distance transform will be applied */
    distfield?: 'deadrec' | 'parabola' | 'none';
    /** Use a different packing algorithm. 'maxrects' is more space-efficient, 'shelf' is faster */
    packing?: 'maxrects' | 'shelf', // default: shelf
    /** Add the specified glyphs to the atlas */
    glyph?: string;
    /** Specify a prepared preset of characters, e.g. ascii or preset20180319 */
    preset?: string;
    /** Add glyphs to the atlas by specifying their character codes, separated by spaces */
    charcode?: number[];
    /** Specify the font size in pixels */
    fontsize?: number, // default = 128;
    /** Use the font with the specified name */
    fontname?: string;
    /** Use the font with the specified path */
    fontpath?: string;
    /** Add padding to each glyph */
    padding: number;
    /** Downsample the atlas by this factor. */
    downsampling: number;
    /** Use a different downsampling algorithm */
    dsalgo: 'average' | 'center' | 'min'; // default = center
    /**
     * Takes two values, BLACK and WHITE. A lower black value will make the distance fields wider;
     * a lower white value will make the distance fields brighter.
     * In most cases, the black value should be lower than the white value.
     * However, swapping the black and white value will invert the colors of the atlas.
     *
     * Requires distfield
     */
    dynamicrange: [number, number]; // default = [-30,20]
    /** Generate a font file in the FNT format */
    fnt?: boolean;

    [key:string]: any,
}

function cliParam(params: AssetGeneratorParams, key: string, transform?: (val: any) => string) {
    let val = params[key];
    if (val === undefined) { return '' }
    val = transform ? transform(val) : val;
    return `--${key} ${params[key]} `
}

class App {

    public app: express.Application;

    constructor() {
        this.app = express();
        this.config();
        this.routes();
    }

    private config(): void {
        //support application/x-www-form-urlencoded post data
        this.app.use(bodyParser.urlencoded({ extended: false }));
        this.app.use(compression())
    }

    private routes(): void {
        this.app.get('/', (req, res) => {
            res.send(`

                <div style="font-family: sans-serif">
                    <h4>OpenLL asset server</h4>
                    Example API calls: <br>
                    <a href="/api/sdf?fontname=Arial&preset=ascii&padding=20">/api/sdf?fontname=Arial&preset=ascii&padding=20</a> (PNG)<br>
                    <a href="/api/sdf?fontname=Arial&preset=ascii&padding=20&fnt=1">/api/sdf?fontname=Arial&preset=ascii&padding=20&fnt=1</a> (FNT)<br>
                    <a href="/api/available_fonts">/api/available_fonts</a> (List of fonts and styles)
                    <br><br>
                    Available parameters (<pre style="display: inline">llassetgen-cmd atlas --help</pre>):<br>
                    (use the long parameter name as query parameter)<br>
                    <i>NOTE: fontpath, glyph, charcode, dynamicrange are not yet supported/tested.</i>
                    <pre>
    -d,--distfield TEXT in {deadrec,parabola}
        Apply a distance transform algorithm to the atlas. If none is chosen, no distancetransform will be applied

    -k,--packing TEXT in {maxrects,shelf}, default = shelf
        Use a different packing algorithm. 'maxrects' is more space-efficient, 'shelf' isfaster

    -g,--glyph TEXT
        Add the specified glyphs to the atlas

    --preset TEXT
        Specify a prepared preset of characters, e.g. ascii or preset20180319

    -c,--charcode UINT ...
        Add glyphs to the atlas by specifying their character codes, separated by spaces

    -s,--fontsize UINT, default = 128
        Specify the font size in pixels

    -f,--fontname TEXT
        Use the font with the specified name
        Hint: styles can be specified like this:
        Roboto:Bold
        Roboto:Bold:Italic

    --fontpath TEXT
        Use the font file at the specified path

    -p,--padding UINT
        Add padding to each glyph

    -w,--downsampling UINT
        Downsample the atlas by this factor.

    --dsalgo TEXT in {average,center,min}, default = center
        Use a different downsampling algorithm

    -r,--dynamicrange INT x 2, default = [-30,20] Requires: -d,--distfield
        Takes two values, BLACK and WHITE. A lower black value will make the distance fields wider; a lower white value will make the distance fields brighter. In most cases, theblack value should be lower than the white value. However, swapping the black and white value will invert the colors of the atlas

    --fnt
        Generate a font file in the FNT format
                    </pre>
                </div>`)
        });

        this.app.get('/api/sdf', [
            query('distfield').isIn(['deadrec', 'parabola', 'none']).optional(),
            query('packing').isIn(['maxrects', 'shelf']).optional(),
            oneOf([
                query('glyph').isString(),
                query('preset').isIn(['ascii', 'preset20180319']),
                //TODO!:custom - check is number?
                query('charcode').isArray(),
            ], 'one of preset, glyph, charcode required'),
            query('fontsize').isNumeric().optional(),
            oneOf([
                query('fontname').isString(),
                query('fontpath').isString(),
            ], 'either fontname or fontpath required'),
            query('padding').isNumeric().optional(),
            query('downsampling').isNumeric().optional(),
            query('dsalgo').isIn(['average', 'center', 'min']).optional(),
            // TODO: test/custom validator?
            query('dynamicrange').isArray().optional(),
            query('fnt').isBoolean().optional(),
        ], (req: any, res: any) => {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
              return res.status(400).json({ errors: errors.array() });
            }

            const params = matchedData(req, { locations: ['query'] }) as AssetGeneratorParams;

            // diffferent default than CLI
            params.distfield = params.distfield === 'none' ? undefined : 'parabola';

            // convert non-string types
            params.charcode = params.charcode && params.charcode.map((c: any) => parseInt(c, 10))
            params.fontsize = params.fontsize && parseInt(params.fontsize as any, 10)
            params.padding = params.padding && parseInt(params.padding as any, 10)
            params.downsampling = params.downsampling && params.downsampling && parseInt(params.downsampling as any, 10)
            params.dynamicrange = params.dynamicrange && params.dynamicrange.map((c: any) => parseInt(c, 10)) as [number, number]
            params.fnt = !!params.fnt

            let args = '';
            args += cliParam(params, 'distfield');
            args += cliParam(params, 'packing');
            args += cliParam(params, 'glyph'); // TODO!: multiple glyphs??
            args += cliParam(params, 'preset');
            args += cliParam(params, 'charcode'); // TODO!: multiple codes??
            args += cliParam(params, 'fontsize');
            args += cliParam(params, 'fontname');
            args += cliParam(params, 'fontpath');
            args += cliParam(params, 'padding');
            args += cliParam(params, 'downsampling');
            args += cliParam(params, 'dsalgo');
            args += cliParam(params, 'dynamicrange'); // TODO!: format??

            // TODO!: work in temp dir & delete afterwards
            // TODO!!: local vs docker cli path...
            shell.cd('/')
            shell.exec(`./llassetgen-cmd atlas "output/atlas.png" ${args} --fnt`, (code, stdout, stderr) => {
                if (code !== 0) {
                    // TODO!!: return 400...
                    console.log(stdout, stderr)
                }

                const extension = params.fnt ? 'fnt' : 'png'
                const options: any = {
                    root: process.cwd(),
                }
                if (params.fnt) {
                    // TODO!: gzip...(static gzip?)
                    options.headers = {'Content-Type': 'text/plain'}
                }
                res.sendFile('output/atlas.' + extension, options)
            })
        })

        this.app.get('/api/available_fonts', (req, res) => {
            // TODO: make sure to execute in docker...
            shell.exec(`fc-list --format="%{family}:style=%{style}\n" | sort | uniq`, (code, stdout, stderr) => {
                if (code !== 0) {
                    // TODO!!: return 400...
                    console.log(stdout, stderr)
                }
                res.send(`<pre>${stdout}</pre>`)
            })
        })
    }

}

export default new App().app;
