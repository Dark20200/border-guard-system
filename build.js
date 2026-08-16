// سكربت البناء: بياخد الكود المقروء من js/ ويعمله تصغير وتشفير أسماء
// المتغيرات (minify + mangle) ويحطه في dist/js/. اللي بيتصفحه الزوار هو
// dist/js بس - الكود الأصلي المقروء في js/ ممنوع يتقرأ من برا (متحجوب في server.js).
//
// طريقة الاستخدام:
//   npm install
//   npm run build
//   ثم شغل السيرفر عادي: npm start

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
            // ملحوظة: مش بنستخدم toplevel mangling هنا. الملفات الأربعة (app.js, archive.js,
            // analyzer.js, admin.js) بتتحمّل كـ script منفصلة وبتنادي على دوال بعض من الـ
            // Global Scope (زي renderArchiveSection, getDiscordAvatarUrl). لو شفرنا أسماء
            // الدوال دي في ملف وسبناها زي ما هي في الملف التاني، النداء بينهم بيتكسر والصفحة
            // بتفضل فاضية. الإعداد ده بيصغر الكود ويشفر أسماء المتغيرات الداخلية بس (آمن ومستقر).
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
