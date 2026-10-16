import assert from 'node:assert/strict';
import test from 'node:test';
import { createCanvas } from '@napi-rs/canvas';
import { createMcWorker, extractMcFields, recognizeMc } from '../src/mc.js';

test('real local OCR extracts scheduling fields from an MC image', async () => {
  const canvas = createCanvas(1200, 350);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = 'white';
  ctx.fillRect(0, 0, 1200, 350);
  ctx.fillStyle = 'black';
  ctx.font = '42px Arial';
  ctx.fillText('Patient Name: Alex Tan', 40, 90);
  ctx.fillText('Unfit for school from 17/10/2026 to 19/10/2026', 40, 180);
  const content = await recognizeMc(canvas.toBuffer('image/png'), 'image/png', createMcWorker);
  assert.deepEqual(extractMcFields(content, '2026-10-16'), {
    name: 'Alex Tan', intervals: [{ start: '2026-10-17', end: '2026-10-19' }],
  });
});

test('scanned PDF renders for local OCR', async () => {
  const canvas = createCanvas(1200, 350);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = 'white';
  ctx.fillRect(0, 0, 1200, 350);
  ctx.fillStyle = 'black';
  ctx.font = '42px Arial';
  ctx.fillText('Patient Name: Alex Tan', 40, 90);
  ctx.fillText('Unfit for school from 17/10/2026 to 19/10/2026', 40, 180);
  const jpeg = canvas.toBuffer('image/jpeg');
  const drawing = Buffer.from('q 600 0 0 175 0 0 cm /Im0 Do Q\n');
  const objects = [
    Buffer.from('<< /Type /Catalog /Pages 2 0 R >>'),
    Buffer.from('<< /Type /Pages /Kids [3 0 R] /Count 1 >>'),
    Buffer.from('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 600 175] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>'),
    Buffer.concat([Buffer.from(`<< /Type /XObject /Subtype /Image /Width 1200 /Height 350 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`), jpeg, Buffer.from('\nendstream')]),
    Buffer.concat([Buffer.from(`<< /Length ${drawing.length} >>\nstream\n`), drawing, Buffer.from('endstream')]),
  ];
  const parts = [Buffer.from('%PDF-1.4\n')];
  const offsets = [0];
  for (const [i, object] of objects.entries()) {
    offsets.push(parts.reduce((total, part) => total + part.length, 0));
    parts.push(Buffer.from(`${i + 1} 0 obj\n`), object, Buffer.from('\nendobj\n'));
  }
  const xref = parts.reduce((total, part) => total + part.length, 0);
  parts.push(Buffer.from(`xref\n0 6\n0000000000 65535 f \n${offsets.slice(1).map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`));
  const content = await recognizeMc(Buffer.concat(parts), 'application/pdf', createMcWorker);
  assert.deepEqual(extractMcFields(content, '2026-10-16').intervals, [{ start: '2026-10-17', end: '2026-10-19' }]);
});
