import { minify } from 'terser';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SRC_DIR = path.join(__dirname, 'js');
const OUT_DIR = path.join(__dirname, 'dist', 'js');

async function build() {
    if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

    const files = fs.readdirSync(SRC_DIR).filter(f => f.endsWith('.js'));

    for (const file of files) {
        const srcPath = path.join(SRC_DIR, file);
        const code = fs.readFileSync(srcPath, 'utf8');

        const result = await minify(code, {
            mangle: true,
            compress: true,
            format: { comments: false }
        });

        if (result.error) {
            console.error(`فشل تصغير الملف ${file}:`, result.error);
            process.exit(1);
        }

        fs.writeFileSync(path.join(OUT_DIR, file), result.code, 'utf8');
        console.log(`تم بناء: ${file}`);
    }

    console.log('اكتمل البناء بنجاح. الملفات جاهزة في dist/js');
}

build();
