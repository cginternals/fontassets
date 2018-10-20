import * as express from "express";
import * as bodyParser from "body-parser";
import { query, validationResult } from "express-validator/check";
import { matchedData } from 'express-validator/filter';
import * as shell from "shelljs";

// Derived from CLI usage string
interface AssetGeneratorParams {
    /** Apply a distance transform algorithm to the atlas. If none is chosen, no distance transform will be applied */
    distfield?: 'deadrec' | 'parabola';
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
    fnt?: boolean,
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
    }

    private routes(): void {
        this.app.get('/', (req, res) => {
            res.send('hello world')
        });

        this.app.get('/api/fnt', [
            query('fontname').isString()
            // TODO!: validate all
        ], (req, res) => {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
              return res.status(400).json({ errors: errors.array() });
            }

            const queryData = matchedData(req, { locations: ['query'] });
            console.log(queryData);
            // TODO!: fill defaults

            // TODO!: call llassetgen-cmd
            // - mktemp -> hashed params...
            const ls = shell.exec('ls')

            res.send('hello fnt' + ls)
            // res.sendFile
        })

        this.app.get('/api/atlas', (req, res) => {

        })
    }

}

export default new App().app;
