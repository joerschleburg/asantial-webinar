import puppeteer from 'puppeteer';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outputFile = path.join(__dirname, 'ASANTIAL-TALENTpro-Award-2026.pdf');

// Use deployed version so all assets load correctly
const url = 'https://joerschleburg.github.io/asantial-webinar/index-talentpro-award.html';

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    args: ['--no-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 2 });
  await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });

  // Wait for fonts + images
  await page.evaluate(() => document.fonts.ready);
  await new Promise(r => setTimeout(r, 3000));

  const totalSlides = await page.evaluate(() => document.querySelectorAll('.slide').length);
  console.log(`Found ${totalSlides} slides`);

  // Save individual PNGs first to verify content
  const pngDir = path.join(__dirname, '_slide_pngs');
  if (!fs.existsSync(pngDir)) fs.mkdirSync(pngDir);

  for (let i = 0; i < totalSlides; i++) {
    await page.evaluate((idx) => {
      const slides = document.querySelectorAll('.slide');
      slides.forEach(s => {
        s.classList.remove('active', 'exit');
        s.style.cssText = 'opacity:0 !important; visibility:hidden !important; pointer-events:none !important; transition:none !important;';
      });

      const target = slides[idx];
      target.classList.add('active');
      target.style.cssText = 'opacity:1 !important; visibility:visible !important; pointer-events:all !important; z-index:999 !important; transition:none !important;';

      // Hide nav + logo
      const nav = document.getElementById('navBar');
      if (nav) nav.style.display = 'none';
      const logo = document.getElementById('logo');
      if (logo) logo.style.display = 'none';

      // Reveal all fragments
      target.querySelectorAll('.cal-entry').forEach(e => {
        e.style.cssText += '; opacity:1 !important; transform:translateY(0) scale(1) !important; max-height:200px !important; margin-bottom:10px !important; position:relative !important; top:0 !important;';
        e.classList.add('visible');
        e.classList.remove('cal-faded');
      });
      target.querySelectorAll('.tf-row').forEach(r => r.classList.add('tf-shown'));
      target.querySelectorAll('.relief-moment').forEach(m => { m.classList.add('relief-shown'); m.style.cssText += '; opacity:1 !important; transform:none !important;'; });
      target.querySelectorAll('.vf-bubble').forEach(b => b.classList.add('vf-visible'));
      target.querySelectorAll('.wendepunkt-card').forEach(c => { c.style.cssText += '; opacity:1 !important; transform:none !important;'; });
      target.querySelectorAll('.ki3-word').forEach(w => { w.style.cssText += '; opacity:1 !important; transform:none !important;'; });
      target.querySelectorAll('.ki3-comma').forEach(c => { c.style.cssText += '; opacity:1 !important;'; });
      target.querySelectorAll('.stagger > *').forEach(s => { s.style.cssText += '; opacity:1 !important; transform:none !important; transition:none !important;'; });
    }, i);

    if (i === 0) {
      await page.evaluate(() => {
        const h1 = document.getElementById('typewriter-h1');
        if (h1) { h1.style.visibility = 'visible'; h1.innerHTML = 'Warum gute HR-Arbeit<br>oft wirkungslos bleibt'; }
      });
    }

    await new Promise(r => setTimeout(r, 500));

    const pngPath = path.join(pngDir, `slide-${String(i + 1).padStart(2, '0')}.png`);
    await page.screenshot({ path: pngPath, clip: { x: 0, y: 0, width: 1920, height: 1080 } });
    console.log(`Captured slide ${i + 1}/${totalSlides} → ${pngPath}`);
  }

  // Now build PDF from the PNG files
  const pdfPage = await browser.newPage();
  await pdfPage.setViewport({ width: 1920, height: 1080 });

  const imgTags = [];
  for (let i = 0; i < totalSlides; i++) {
    const pngPath = path.join(pngDir, `slide-${String(i + 1).padStart(2, '0')}.png`);
    const b64 = fs.readFileSync(pngPath).toString('base64');
    const pageBreak = i < totalSlides - 1 ? 'page-break-after:always;' : '';
    imgTags.push(`<div style="width:1920px;height:1080px;${pageBreak}"><img src="data:image/png;base64,${b64}" style="width:1920px;height:1080px;display:block;"></div>`);
  }

  const tempHtml = path.join(__dirname, '_temp_pdf.html');
  fs.writeFileSync(tempHtml, `<!DOCTYPE html><html><head><style>*{margin:0;padding:0;}@page{size:1920px 1080px;margin:0;}body{margin:0;padding:0;}</style></head><body>${imgTags.join('\n')}</body></html>`);

  await pdfPage.goto(`file://${tempHtml}`, { waitUntil: 'load', timeout: 120000 });
  // Wait for all images to decode
  await pdfPage.evaluate(async () => {
    const imgs = document.querySelectorAll('img');
    await Promise.all(Array.from(imgs).map(img => img.decode ? img.decode().catch(() => {}) : Promise.resolve()));
  });
  await new Promise(r => setTimeout(r, 2000));

  await pdfPage.pdf({
    path: outputFile,
    width: '1920px',
    height: '1080px',
    printBackground: true,
    margin: { top: '0', right: '0', bottom: '0', left: '0' },
    preferCSSPageSize: true
  });

  fs.unlinkSync(tempHtml);

  const stats = fs.statSync(outputFile);
  console.log(`PDF saved: ${outputFile} (${(stats.size / 1024 / 1024).toFixed(1)} MB)`);

  // Check first PNG size to verify content
  const firstPng = fs.statSync(path.join(pngDir, 'slide-01.png'));
  console.log(`First slide PNG: ${(firstPng.size / 1024).toFixed(0)} KB`);

  await browser.close();
})();
