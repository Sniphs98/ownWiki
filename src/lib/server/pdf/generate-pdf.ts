import { chromium } from 'playwright';
import { renderPrintableHtml, type PrintablePage } from './render-html';

export async function generatePdf(pages: PrintablePage[], wikiTitle: string): Promise<Buffer> {
	const html = await renderPrintableHtml(pages, wikiTitle);

	const browser = await chromium.launch();
	try {
		const page = await browser.newPage();
		await page.setContent(html, { waitUntil: 'networkidle' });
		const pdf = await page.pdf({
			format: 'A4',
			printBackground: true,
			displayHeaderFooter: true,
			headerTemplate: '<span></span>',
			footerTemplate:
				'<div style="width:100%;font-size:8px;color:#999;text-align:center;">' +
				'<span class="pageNumber"></span> / <span class="totalPages"></span></div>'
		});
		return pdf;
	} finally {
		await browser.close();
	}
}
