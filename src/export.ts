import type { Project } from './model';

const pdfFontName = 'RailplotSans';

let fontData: Promise<string> | undefined;

export function download(data: Blob, name: string) {
  const url = URL.createObjectURL(data);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  anchor.click();

  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function saveProject(project: Project) {
  const source = JSON.stringify(project, null, 2);
  download(
    new Blob([source], { type: 'application/json' }),
    `${safeName(project.name)}.railplot`,
  );
}

function safeName(name: string) {
  return name.replace(/[\\/:*?"<>|]/g, '_');
}

function prepareSvg(svg: SVGSVGElement): SVGSVGElement {
  const copy = svg.cloneNode(true) as SVGSVGElement;
  const { width, height } = svg.viewBox.baseVal;

  copy.removeAttribute('style');
  copy.setAttribute('width', String(width));
  copy.setAttribute('height', String(height));
  copy
    .querySelectorAll('[data-interactive]')
    .forEach((element) => element.remove());
  copy.querySelectorAll('[data-train]').forEach((element) => {
    element.setAttribute('opacity', '1');
    element.removeAttribute('tabindex');
    element.removeAttribute('role');
    element.removeAttribute('style');
  });

  return copy;
}

async function loadPdfFont(): Promise<string> {
  if (!fontData) {
    fontData = (async () => {
      const response = await fetch(
        `${import.meta.env.BASE_URL}fonts/RailplotSans-Regular.ttf`,
      );
      if (!response.ok)
        throw new Error('中文字体加载失败，请检查本地字体文件。');

      const bytes = new Uint8Array(await response.arrayBuffer());
      const face = new FontFace(pdfFontName, bytes);
      document.fonts.add(await face.load());

      const chunks: string[] = [];
      for (let offset = 0; offset < bytes.length; offset += 8192) {
        chunks.push(
          String.fromCharCode(...bytes.subarray(offset, offset + 8192)),
        );
      }

      return btoa(chunks.join(''));
    })().catch((error) => {
      fontData = undefined;
      throw error;
    });
  }

  return fontData;
}

async function renderPdf(svg: SVGSVGElement, project: Project): Promise<void> {
  const [{ jsPDF }, { svg2pdf }, font] = await Promise.all([
    import('jspdf'),
    import('svg2pdf.js'),
    loadPdfFont(),
  ]);
  const { width, height } = svg.viewBox.baseVal;
  const pdf = new jsPDF({
    orientation: width > height ? 'landscape' : 'portrait',
    unit: 'pt',
    format: [width, height],
    compress: true,
    putOnlyUsedFonts: true,
  });

  // 嵌入完整字体的实际使用字形，保留中文可检索文字与矢量线条。
  pdf.addFileToVFS('RailplotSans.ttf', font);
  pdf.addFont('RailplotSans.ttf', pdfFontName, 'normal');
  pdf.setFont(pdfFontName, 'normal');
  pdf.setProperties({ title: project.name, creator: 'Railplot' });

  const textMetrics = document.createElement('canvas').getContext('2d');

  svg.setAttribute('font-family', pdfFontName);
  svg.querySelectorAll('text').forEach((element) => {
    element.setAttribute('font-family', pdfFontName);
    element.setAttribute('font-weight', 'normal');

    // svg2pdf 不支持 paint-order；用矢量底色避免描边盖住车次文字。
    if (element.hasAttribute('stroke') && textMetrics) {
      const size = Number(element.getAttribute('font-size') ?? 12);
      textMetrics.font = `${size}px ${pdfFontName}`;
      const textWidth = textMetrics.measureText(
        element.textContent ?? '',
      ).width;
      const x = Number(element.getAttribute('x'));
      const y = Number(element.getAttribute('y'));
      const background = document.createElementNS(
        'http://www.w3.org/2000/svg',
        'rect',
      );
      background.setAttribute('x', String(x - textWidth / 2 - 3));
      background.setAttribute('y', String(y - size));
      background.setAttribute('width', String(textWidth + 6));
      background.setAttribute('height', String(size * 1.3));
      background.setAttribute('fill', '#ffffff');
      element.before(background);
      element.removeAttribute('stroke');
      element.removeAttribute('stroke-width');
      element.removeAttribute('paint-order');
    }
  });

  await svg2pdf(svg, pdf, { x: 0, y: 0, width, height });
  pdf.save(`${safeName(project.name)}.pdf`);
}

async function renderPng(svg: SVGSVGElement, name: string): Promise<void> {
  const { width, height } = svg.viewBox.baseVal;
  const scale = Math.min(3, 12000 / Math.max(width, height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);

  const context = canvas.getContext('2d');
  if (!context) throw new Error('浏览器不支持图片绘制。');

  const source = new XMLSerializer().serializeToString(svg);
  const url = URL.createObjectURL(
    new Blob([source], { type: 'image/svg+xml;charset=utf-8' }),
  );

  try {
    const image = new Image();
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error('图表渲染失败。'));
      image.src = url;
    });

    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((result) => {
        if (result) resolve(result);
        else reject(new Error('PNG 导出失败。'));
      }, 'image/png');
    });

    download(blob, `${safeName(name)}.png`);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function exportImage(
  svg: SVGSVGElement,
  project: Project,
  format: 'png' | 'pdf' | 'svg',
) {
  await document.fonts.ready;
  const copy = prepareSvg(svg);

  if (format === 'pdf') {
    await renderPdf(copy, project);
    return;
  }

  if (format === 'png') {
    await renderPng(copy, project.name);
    return;
  }

  const source = new XMLSerializer().serializeToString(copy);
  download(
    new Blob([source], { type: 'image/svg+xml' }),
    `${safeName(project.name)}.svg`,
  );
}
