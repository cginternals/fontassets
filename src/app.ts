import * as express from "express";
import * as compression from "compression";
import * as bodyParser from "body-parser";
import * as validator from "validator";
import { query, oneOf, validationResult } from "express-validator/check";
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
    charcode?: string;
    /** Specify the font size in pixels */
    fontsize?: string, // default = 128;
    /** Use the font with the specified name */
    fontname?: string;
    /** Use the font with the specified path */
    fontpath?: string;
    /** Add padding to each glyph */
    padding?: string;
    /** Downsample the atlas by this factor. */
    downsampling?: string;
    /** Use a different downsampling algorithm */
    dsalgo?: 'average' | 'center' | 'min'; // default = center
    /**
     * Takes two values, BLACK and WHITE. A lower black value will make the distance fields wider;
     * a lower white value will make the distance fields brighter.
     * In most cases, the black value should be lower than the white value.
     * However, swapping the black and white value will invert the colors of the atlas.
     *
     * Requires distfield
     */
    dynamicrange?: string; // default = `-30 20`
    /** Generate a font file in the FNT format */
    fnt?: boolean;

    [key:string]: any,
}

function cliParam(params: AssetGeneratorParams, key: string, transform?: (val: any) => string, quote='"') {
    let val = params[key];
    if (val === undefined) { return '' }
    val = transform ? transform(val) : val;
    return `--${key} ${quote}${params[key]}${quote} `
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
                    Available are all Google Fonts and Microsoft's True Type Core Fonts.
                    <br><br>
                    Available query parameters (adapted from <pre style="display: inline">llassetgen-cmd atlas --help</pre>):<br>
                    <pre>
    distfield TEXT in {deadrec,parabola,none}, default = parabola
        Apply a distance transform algorithm to the atlas. If none is chosen, no distancetransform will be applied

    packing TEXT in {maxrects,shelf}, default = shelf
        Use a different packing algorithm. 'maxrects' is more space-efficient, 'shelf' isfaster

    glyph TEXT
        Add the specified glyphs to the atlas

    preset TEXT in {ascii, preset20180319}
        Specify a prepared preset of characters.

    charcode UINT ...
        Add glyphs to the atlas by specifying their character codes, separated by spaces

    fontsize UINT, default = 128
        Specify the font size in pixels

    fontname TEXT
        Use the font with the specified name
        Hint: styles can be specified like this:
        Roboto:Bold
        Roboto:Bold:Italic

    fontpath TEXT
        Use the font file at the specified path

    padding UINT
        Add padding to each glyph

    downsampling UINT
        Downsample the atlas by this factor.

    dsalgo TEXT in {average,center,min}, default = center
        Use a different downsampling algorithm

    dynamicrange INT x 2, default = -30,20 Requires: distfield
        Takes two values, BLACK and WHITE. A lower black value will make the distance fields wider; a lower white value will make the distance fields brighter. In most cases, theblack value should be lower than the white value. However, swapping the black and white value will invert the colors of the atlas

    fnt
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
                query('charcode').custom((value) => {
                    if (!value.split(",").every(validator.isInt)) {
                        throw new Error("expected two integers, got: " + value)
                    }
                    return true
                }),
            ], 'one of preset, glyph, charcode required'),
            query('fontsize').isInt().optional(),
            oneOf([
                query('fontname').isString(),
                query('fontpath').isString(),
            ], 'either fontname or fontpath required'),
            query('padding').isInt().optional(),
            query('downsampling').isInt().optional(),
            query('dsalgo').isIn(['average', 'center', 'min']).optional(),
            query('dynamicrange').optional().custom((value) => {
                let values = value.split(",")
                if (values.length !== 2) {
                    throw new Error("expected 2 values, got: " + value);
                }
                if (!values.every(validator.isInt)) {
                    throw new Error("expected two integers, got: " + value)
                }
                return true
            }),
            query('fnt').optional(),
        ], (req: any, res: any) => {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
              return res.status(400).json({ errors: errors.array() });
            }

            const params = matchedData(req, { locations: ['query'] }) as AssetGeneratorParams;

            // diffferent default than CLI
            params.distfield = params.distfield === 'none' ? undefined : 'parabola';

            params.fnt = params.fnt !== undefined;

            let args = '';
            args += cliParam(params, 'distfield');
            args += cliParam(params, 'packing');
            args += cliParam(params, 'glyph');
            args += cliParam(params, 'preset');
            args += cliParam(params, 'charcode', val => val.replace(",", " "), '');
            args += cliParam(params, 'fontsize');
            args += cliParam(params, 'fontname');
            args += cliParam(params, 'fontpath');
            args += cliParam(params, 'padding');
            args += cliParam(params, 'downsampling');
            args += cliParam(params, 'dsalgo');
            args += cliParam(params, 'dynamicrange', val => val.replace(",", " "), '');

            // TODO!: work in temp dir & delete afterwards
            if (process.env.NODE_ENV === 'production') {
                // locally (outside docker), we use the `llassetgen-cmd` script in this repository
                // that wraps a docker call.
                // In docker (production), the actual llassetgen-cmd is in the root of the container
                shell.cd('/')
            }
            shell.exec(`./llassetgen-cmd atlas "output/atlas.png" ${args} --fnt`, (code, stdout, stderr) => {
                if (code !== 0) {
                    console.log(stdout, stderr)
                    return res.status(500).json({ stdout: stdout, stderr: stderr });
                }

                const extension = params.fnt ? 'fnt' : 'png'
                const options: any = {
                    root: process.cwd(),
                }
                if (params.fnt) {
                    options.headers = {'Content-Type': 'text/plain'}
                }
                res.sendFile('output/atlas.' + extension, options)
            })
        })

        this.app.get('/api/available_fonts', (req, res) => {
            // TODO: make sure to execute in docker...
            // TODO!: why is this so slow? (20s)
            shell.exec(`fc-list --format="%{family}:style=%{style}\n" | sort | uniq`, (code, stdout, stderr) => {
                if (code !== 0) {
                    return res.status(500).json({ stdout: stdout, stderr: stderr });
                }
                res.send(`<pre>${stdout}</pre>`)
            })
        })
    }

}

export default new App().app;
