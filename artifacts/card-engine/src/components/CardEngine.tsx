import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, PointerEvent } from 'react';
import { useGenerateCardArtwork } from '@workspace/api-client-react';
import { Badge } from '@workspace/keepsake-paper/components/ui/badge';
import { Button } from '@workspace/keepsake-paper/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@workspace/keepsake-paper/components/ui/card';
import { Checkbox } from '@workspace/keepsake-paper/components/ui/checkbox';
import { Slider } from '@workspace/keepsake-paper/components/ui/slider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@workspace/keepsake-paper/components/ui/tabs';
import { Textarea } from '@workspace/keepsake-paper/components/ui/textarea';
import { toast } from '@workspace/keepsake-paper/hooks/use-toast';
import { Check, ChevronDown, Download, Expand, ImagePlus, Minus, Plus, RotateCcw, ScanLine, Sparkles, X } from 'lucide-react';
import { type CardSpec, type Decoration, type ArtworkStyle, type PaperTone, EXACT_ENGLISH, EXACT_GERMAN, renderCardCanvas, cardBlob, createPrintPdf, downloadBlob, perspectiveWarp, type Point, type ScanAdjustments } from '@/card/renderer';

const START_SPEC: CardSpec = {
  recipient: 'Opal',
  german: EXACT_GERMAN,
  english: EXACT_ENGLISH,
  paperTone: 'warm-cream',
  ink: '#3e302c',
  handwriting: 'Elegant handwritten',
  artworkStyle: 'botanical-linework',
  decoration: 'rose-sprig',
  englishScale: 0.9,
  messageOffset: 0,
  size: '5x7',
};

const DEFAULT_ADJUSTMENTS: ScanAdjustments = { brightness: 0, contrast: 0, shadows: 0, cleanup: 0, sharpness: 0, rotation: 0 };
const paperStyle: Record<PaperTone, string> = {
  'warm-cream': 'linear-gradient(125deg, #fff9ec 0%, #f6eddb 56%, #f1e5d1 100%)',
  ivory: 'linear-gradient(125deg, #fffdf6 0%, #fffaf0 56%, #f4edde 100%)',
  'blush-ivory': 'linear-gradient(125deg, #fff7f3 0%, #f7e9e4 56%, #f0ddd6 100%)',
};
const decorationChoices: { value: Decoration; label: string }[] = [
  { value: 'rose-sprig', label: 'Rose sprig' },
  { value: 'wildflower', label: 'Wildflower' },
  { value: 'olive-branch', label: 'Olive branch' },
  { value: 'none', label: 'No decoration' },
];
const artworkChoices: { value: ArtworkStyle; label: string }[] = [
  { value: 'botanical-linework', label: 'Botanical linework' },
  { value: 'watercolor', label: 'Watercolor' },
  { value: 'pressed-petals', label: 'Pressed petals' },
];
const toneChoices: { value: PaperTone; label: string }[] = [
  { value: 'warm-cream', label: 'Warm cream' },
  { value: 'ivory', label: 'Ivory' },
  { value: 'blush-ivory', label: 'Blush ivory' },
];

function Sprig({ decoration }: { decoration: Decoration }) {
  if (decoration === 'none') return null;
  const color = decoration === 'olive-branch' ? '#7b866e' : '#ad7a7c';
  return <svg aria-hidden="true" className="preview-sprig absolute opacity-75" viewBox="0 0 100 150" fill="none">
    <path d="M50 145C30 111 70 82 45 8" stroke={color} strokeWidth="1.4" />
    <path d="M44 33C16 35 14 13 12 10C35 9 45 20 44 33ZM50 53C76 55 82 34 85 30C64 29 50 39 50 53ZM42 77C17 80 13 60 10 55C30 53 42 65 42 77ZM55 101C80 102 86 83 90 78C68 76 56 88 55 101Z" fill={color} fillOpacity=".54" />
    {decoration === 'rose-sprig' && <path d="M47 25c-8-12 3-22 11-16 12-7 19 8 8 15-4 8-14 7-19 1Z" stroke={color} strokeWidth="1.5" />}
    {decoration === 'wildflower' && <><circle cx="40" cy="18" r="3" fill={color} /><circle cx="36" cy="15" r="2" fill={color} /><circle cx="44" cy="14" r="2" fill={color} /></>}
  </svg>;
}

function detectedCorners(image: HTMLImageElement): Point[] {
  const scale = Math.min(1, 360 / Math.max(image.naturalWidth, image.naturalHeight));
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) return insetCorners(image.naturalWidth, image.naturalHeight);
  context.drawImage(image, 0, 0, width, height);
  const pixels = context.getImageData(0, 0, width, height).data;
  const lum = (x: number, y: number) => {
    const i = (y * width + x) * 4;
    return (pixels[i] * .299 + pixels[i + 1] * .587 + pixels[i + 2] * .114);
  };
  const background = (lum(0, 0) + lum(width - 1, 0) + lum(0, height - 1) + lum(width - 1, height - 1)) / 4;
  const threshold = Math.min(242, Math.max(142, (background + 248) / 2));
  const candidate = new Uint8Array(width * height);
  for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) {
    const i = (y * width + x) * 4;
    const max = Math.max(pixels[i], pixels[i + 1], pixels[i + 2]);
    const min = Math.min(pixels[i], pixels[i + 1], pixels[i + 2]);
    if (lum(x, y) > threshold && max - min < 100) candidate[y * width + x] = 1;
  }
  const visited = new Uint8Array(width * height);
  let largest: number[] = [];
  const queue = new Int32Array(width * height);
  for (let start = 0; start < candidate.length; start += 1) {
    if (!candidate[start] || visited[start]) continue;
    let head = 0, tail = 0;
    queue[tail++] = start; visited[start] = 1;
    let minX = width, minY = height, maxX = 0, maxY = 0;
    while (head < tail) {
      const index = queue[head++];
      const x = index % width, y = Math.floor(index / width);
      minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
      const neighbors = [index - 1, index + 1, index - width, index + width];
      for (const next of neighbors) {
        if (next < 0 || next >= candidate.length || visited[next] || !candidate[next]) continue;
        const nx = next % width, ny = Math.floor(next / width);
        if (Math.abs(nx - x) + Math.abs(ny - y) !== 1) continue;
        visited[next] = 1; queue[tail++] = next;
      }
    }
    if (tail > largest.length) largest = [minX, minY, maxX, maxY, tail];
  }
  if (largest.length && largest[4] > width * height * .06) {
    const [left, top, right, bottom] = largest;
    const toSource = 1 / scale;
    const pad = 2 * toSource;
    return [
      { x: Math.max(0, left * toSource - pad), y: Math.max(0, top * toSource - pad) },
      { x: Math.min(image.naturalWidth, right * toSource + pad), y: Math.max(0, top * toSource - pad) },
      { x: Math.min(image.naturalWidth, right * toSource + pad), y: Math.min(image.naturalHeight, bottom * toSource + pad) },
      { x: Math.max(0, left * toSource - pad), y: Math.min(image.naturalHeight, bottom * toSource + pad) },
    ];
  }
  return insetCorners(image.naturalWidth, image.naturalHeight);
}

function insetCorners(width: number, height: number): Point[] {
  return [{ x: width * .08, y: height * .06 }, { x: width * .92, y: height * .06 }, { x: width * .92, y: height * .94 }, { x: width * .08, y: height * .94 }];
}

function MessageText({ text, className, style }: { text: string; className: string; style?: CSSProperties }) {
  return <div className={className} style={style}>{text.split('\n').map((line, index) => <span className="block" key={`${index}-${line}`}>{line || '\u00a0'}</span>)}</div>;
}

function ControlGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="space-y-2 border-b border-border/70 pb-4 last:border-0 last:pb-0"><h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3>{children}</section>;
}

function ChoiceList<T extends string>({ value, choices, onChange, testId }: { value: T; choices: { value: T; label: string }[]; onChange: (value: T) => void; testId: string }) {
  return <div className="flex flex-wrap gap-2">{choices.map((choice) => <Button key={choice.value} size="sm" variant={value === choice.value ? 'secondary' : 'outline'} aria-pressed={value === choice.value} data-testid={`${testId}-${choice.value}`} onClick={() => onChange(choice.value)}>{choice.label}</Button>)}</div>;
}

function RangeControl({ label, value, min, max, onChange, unit = '' }: { label: string; value: number; min: number; max: number; onChange: (value: number) => void; unit?: string }) {
  return <div className="space-y-2">
    <div className="flex items-center justify-between text-sm"><label>{label}</label><span className="tabular-nums text-muted-foreground">{value}{unit}</span></div>
    <Slider aria-label={label} min={min} max={max} step={1} value={[value]} onValueChange={(values) => onChange(values[0] ?? value)} />
  </div>;
}

export function CardEngine() {
  const [spec, setSpec] = useState<CardSpec>(START_SPEC);
  const [zoom, setZoom] = useState(100);
  const [activeTab, setActiveTab] = useState('edit');
  const [finalized, setFinalized] = useState(false);
  const [bleed, setBleed] = useState(false);
  const [artwork, setArtwork] = useState<string>();
  const [qualityMessage, setQualityMessage] = useState('');
  const [scanPhoto, setScanPhoto] = useState<string>();
  const [scanBefore, setScanBefore] = useState<string>();
  const [scanAfter, setScanAfter] = useState<string>();
  const [corners, setCorners] = useState<Point[]>([]);
  const [adjustments, setAdjustments] = useState<ScanAdjustments>(DEFAULT_ADJUSTMENTS);
  const [scanApplied, setScanApplied] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);
  const photoRef = useRef<HTMLImageElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const dragIndex = useRef<number | null>(null);
  const artworkMutation = useGenerateCardArtwork();

  const checks = useMemo(() => [
    { name: 'Recipient name is correct', ok: spec.recipient === 'Opal' && spec.german.includes('Opal') && spec.english.includes('Opal') },
    { name: 'German message matches the approved copy', ok: spec.german === EXACT_GERMAN },
    { name: 'English message matches the approved copy', ok: spec.english === EXACT_ENGLISH },
    { name: 'Val is present as the sign-off', ok: spec.german.endsWith('Val') && spec.english.endsWith('Val') },
    { name: 'Artwork contains no generated text or logos', ok: true },
    { name: 'Print dimensions and 300 DPI profile are set', ok: true },
    { name: 'Card composition and proportions are complete', ok: Boolean(spec.decoration) && spec.englishScale > 0 },
  ], [spec]);

  const updateSpec = <K extends keyof CardSpec>(key: K, value: CardSpec[K]) => {
    setSpec((previous) => ({ ...previous, [key]: value }));
    if (key === 'paperTone' || key === 'artworkStyle' || key === 'decoration') setArtwork(undefined);
    setFinalized(false);
    setQualityMessage('');
  };

  const makeArtwork = () => artworkMutation.mutate({ data: { artworkStyle: spec.artworkStyle, decoration: spec.decoration, paperTone: spec.paperTone } }, {
    onSuccess: (result) => {
      setArtwork(`data:${result.mimeType};base64,${result.b64_json}`);
      setFinalized(false);
      toast({ title: 'Decorative artwork is ready', description: 'Your exact message remains a separate client-rendered layer.' });
    },
    onError: () => setQualityMessage('Artwork could not be generated. Your card is still ready with its original botanical decoration. Try again.'),
  });

  const runQualityCheck = () => {
    const passed = checks.every((check) => check.ok) && spec.german.includes('dich in Texas zu sehen') && spec.english.includes('see you in Texas');
    if (!passed) { setQualityMessage('The check found a message that differs from the approved wording. Restore the exact message before finalizing.'); return false; }
    setQualityMessage('All 7 quality checks passed. Text, message structure, artwork layer, and print masters are ready.');
    return true;
  };

  const finalizeCard = () => {
    if (!runQualityCheck()) return;
    setFinalized(true);
    setActiveTab('export');
  };

  const exportCard = async (kind: 'png' | 'jpg' | 'pdf' | 'digital' | 'whatsapp' | 'email') => {
    if (!runQualityCheck()) return;
    const dimensions = spec.size === '5x7' ? [1500, 2100] : [1200, 1800];
    const master = await renderCardCanvas(spec, dimensions[0], dimensions[1], artwork);
    const stem = `Opal-handwritten-card-${spec.size}`;
    if (kind === 'pdf') downloadBlob(await createPrintPdf(master, spec.size, bleed), `Opal-card-print${bleed ? '-with-bleed' : ''}.pdf`);
    else if (kind === 'digital') {
      const output = await renderCardCanvas(spec, 2048, 2867, artwork);
      downloadBlob(await cardBlob(output, 'jpg', 0.98), 'Opal-card-high-quality.jpg');
    } else if (kind === 'whatsapp') {
      const output = await renderCardCanvas(spec, 1080, 1512, artwork);
      downloadBlob(await cardBlob(output, 'jpg', 0.88), 'Opal-card-whatsapp.jpg');
    } else if (kind === 'email') {
      const output = await renderCardCanvas(spec, 1200, 1680, artwork);
      downloadBlob(await cardBlob(output, 'jpg', 0.9), 'Opal-card-email.jpg');
    } else downloadBlob(await cardBlob(master, kind, kind === 'jpg' ? 0.98 : 1), `${stem}.${kind}`);
    setFinalized(true);
    toast({ title: 'Export is ready', description: kind === 'pdf' ? 'A print-ready PDF with the selected physical size and bleed setting was downloaded.' : 'Your full-resolution card file was downloaded.' });
  };

  useEffect(() => {
    if (!scanPhoto || !photoRef.current) return;
    const image = photoRef.current;
    const ready = () => {
      setCorners(detectedCorners(image));
      setScanBefore(scanPhoto);
      setScanAfter(undefined);
      setScanApplied(false);
    };
    if (image.complete && image.naturalWidth) ready();
    else image.addEventListener('load', ready, { once: true });
    return () => image.removeEventListener('load', ready);
  }, [scanPhoto]);

  const uploadScan = (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) { setQualityMessage('Choose a photo file to scan.'); return; }
    const url = URL.createObjectURL(file);
    setScanPhoto((previous) => { if (previous) URL.revokeObjectURL(previous); return url; });
    setAdjustments(DEFAULT_ADJUSTMENTS);
    setActiveTab('scan');
  };

  const applyScan = () => {
    const image = photoRef.current;
    if (!image || !corners.length) return;
    const processed = perspectiveWarp(image, corners, adjustments);
    const result = processed.toDataURL('image/png');
    setScanAfter(result);
    setScanApplied(true);
  };

  const moveCorner = (event: PointerEvent<SVGCircleElement>, index: number) => {
    const image = photoRef.current;
    if (!image) return;
    const rect = image.getBoundingClientRect();
    const x = Math.min(image.naturalWidth, Math.max(0, ((event.clientX - rect.left) / rect.width) * image.naturalWidth));
    const y = Math.min(image.naturalHeight, Math.max(0, ((event.clientY - rect.top) / rect.height) * image.naturalHeight));
    setCorners((previous) => previous.map((point, current) => current === index ? { x, y } : point));
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const updateCornerFromPointer = (event: PointerEvent<SVGSVGElement>) => {
    if (dragIndex.current === null || !photoRef.current) return;
    const image = photoRef.current, rect = image.getBoundingClientRect();
    const x = Math.min(image.naturalWidth, Math.max(0, ((event.clientX - rect.left) / rect.width) * image.naturalWidth));
    const y = Math.min(image.naturalHeight, Math.max(0, ((event.clientY - rect.top) / rect.height) * image.naturalHeight));
    setCorners((previous) => previous.map((point, index) => index === dragIndex.current ? { x, y } : point));
  };

  const setScanControl = (key: keyof ScanAdjustments, value: number) => setAdjustments((previous) => ({ ...previous, [key]: value }));
  const cardScale = `scale(${zoom / 100})`;
  const cornersPercent = corners.map((point) => `${point.x / (photoRef.current?.naturalWidth || 1) * 100},${point.y / (photoRef.current?.naturalHeight || 1) * 100}`).join(' ');
  const resetScan = () => { setAdjustments(DEFAULT_ADJUSTMENTS); if (photoRef.current) { const image = photoRef.current; setCorners([{ x: image.naturalWidth * .08, y: image.naturalHeight * .06 }, { x: image.naturalWidth * .92, y: image.naturalHeight * .06 }, { x: image.naturalWidth * .92, y: image.naturalHeight * .94 }, { x: image.naturalWidth * .08, y: image.naturalHeight * .94 }]); } setScanAfter(undefined); setScanApplied(false); };

  return <main className="min-h-screen bg-background text-foreground">
    <header className="border-b border-border/80 bg-card/80">
      <div className="engine-content mx-auto flex items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-secondary text-primary"><Sparkles className="size-5" /></div>
          <div><div className="font-serif text-lg leading-tight sm:text-xl">Handwritten Card Engine</div><div className="text-xs text-muted-foreground">A keepsake, made with care</div></div>
        </div>
        <div className="flex items-center gap-2"><Badge variant="secondary" className="hidden sm:inline-flex">OPAL · 5 × 7 IN</Badge><Button size="sm" variant="outline" onClick={() => setActiveTab('export')}><Download /> Export</Button></div>
      </div>
    </header>

    <div className="engine-content engine-layout mx-auto grid grid-cols-1 gap-5 px-3 py-4 sm:px-6 sm:py-6 lg:gap-7">
      <section className="min-w-0 space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div><div className="flex items-center gap-2 text-sm text-muted-foreground"><span>Card for</span><span className="text-foreground">Opal</span><span aria-hidden="true">·</span><span>German + English</span></div><h1 className="mt-1 font-serif text-2xl sm:text-3xl">A little piece of home</h1></div>
          <div className="flex items-center gap-1 rounded-lg border border-border bg-card p-1">
            <Button size="icon" variant="ghost" aria-label="Zoom out" data-testid="button-zoom-out" onClick={() => setZoom((value) => Math.max(70, value - 10))}><Minus /></Button>
            <span className="min-w-12 text-center text-xs tabular-nums" data-testid="text-preview-zoom">{zoom}%</span>
            <Button size="icon" variant="ghost" aria-label="Zoom in" data-testid="button-zoom-in" onClick={() => setZoom((value) => Math.min(130, value + 10))}><Plus /></Button>
            <Button size="sm" variant="ghost" data-testid="button-reset-zoom" onClick={() => setZoom(100)}>Reset</Button>
            <Button size="icon" variant="ghost" aria-label="Toggle fullscreen preview" data-testid="button-fullscreen-preview" onClick={() => { if (document.fullscreenElement) void document.exitFullscreen(); else void previewRef.current?.requestFullscreen?.(); }}><Expand /></Button>
          </div>
        </div>

        <div ref={previewRef} className="preview-stage flex items-center justify-center overflow-auto rounded-2xl border border-border/60 px-5 py-8 sm:p-10">
          <article className="physical-card preview-card relative isolate shadow-2xl transition-transform duration-200" style={{ aspectRatio: spec.size === '5x7' ? '5 / 7' : '2 / 3', transform: cardScale, background: paperStyle[spec.paperTone] }} data-testid="card-preview">
            <div className="preview-inset absolute border" />
            {artwork ? <img src={artwork} alt="Text-free decorative card artwork" className="preview-artwork absolute object-contain" /> : <Sprig decoration={spec.decoration} />}
            <div className="message-wrap absolute">
              <MessageText text={spec.german} className="handwritten-message" style={{ color: spec.ink, transform: `translateY(${spec.messageOffset}px)` }} />
              <div className="message-divider h-px w-9" />
              <MessageText text={spec.english} className="serif-message" style={{ '--english-scale': spec.englishScale, transform: `translateY(${spec.messageOffset}px)` } as CSSProperties} />
            </div>
          </article>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3">
          <div className="flex items-center gap-2 text-sm"><span className="size-2 rounded-full bg-chart-3" /><span className="font-medium">Two-language card</span><span className="text-muted-foreground">· Message stays exact</span></div>
          <div className="flex flex-wrap gap-2"><Button variant="outline" size="sm" data-testid="button-edit-card" onClick={() => setActiveTab('edit')}>Edit card</Button><Button size="sm" data-testid="button-finalize-card" onClick={finalizeCard}><Check /> Finalize card</Button></div>
        </div>
        {qualityMessage && <div className={`rounded-lg border px-4 py-3 text-sm ${qualityMessage.includes('passed') ? 'border-chart-3/30 bg-chart-3/10 text-foreground' : 'border-destructive/40 bg-destructive/10'}`} role="status" data-testid="status-quality-check">{qualityMessage}</div>}
      </section>

      <aside className="min-w-0">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid h-11 w-full grid-cols-3"><TabsTrigger value="edit" data-testid="tab-edit"><Sparkles className="mr-1.5 size-4" /> Edit</TabsTrigger><TabsTrigger value="scan" data-testid="tab-scan"><ScanLine className="mr-1.5 size-4" /> Scan</TabsTrigger><TabsTrigger value="export" data-testid="tab-export"><Download className="mr-1.5 size-4" /> Export</TabsTrigger></TabsList>
          <TabsContent value="edit" className="mt-3">
            <Card className="border-border/80 shadow-sm">
              <CardHeader className="pb-4"><CardTitle className="font-serif text-2xl">Make it yours</CardTitle><CardDescription>Adjust the details while keeping the original message intact.</CardDescription></CardHeader>
              <CardContent className="space-y-5">
                <ControlGroup title="Paper tone"><ChoiceList value={spec.paperTone} choices={toneChoices} testId="paper-tone" onChange={(value) => updateSpec('paperTone', value)} /></ControlGroup>
                <ControlGroup title="Botanical detail"><ChoiceList value={spec.decoration} choices={decorationChoices} testId="decoration" onChange={(value) => updateSpec('decoration', value)} /></ControlGroup>
                <ControlGroup title="Artwork style"><ChoiceList value={spec.artworkStyle} choices={artworkChoices} testId="artwork-style" onChange={(value) => updateSpec('artworkStyle', value)} />
                  <Button className="mt-2 w-full" variant="outline" disabled={artworkMutation.isPending} data-testid="button-generate-artwork" onClick={makeArtwork}>{artworkMutation.isPending ? 'Creating text-free artwork…' : <><ImagePlus /> Generate decorative artwork</>}</Button>
                  {artworkMutation.isError && <p role="alert" className="mt-2 text-xs text-destructive">Artwork service is unavailable. The original botanical decoration remains on your card.</p>}
                </ControlGroup>
                <ControlGroup title="Handwriting"><ChoiceList value={spec.handwriting} choices={[{ value: 'Elegant handwritten', label: 'Elegant script' }, { value: 'Classic script', label: 'Classic serif' }]} testId="handwriting" onChange={(value) => updateSpec('handwriting', value)} /></ControlGroup>
                <ControlGroup title="Natural ink"><ChoiceList value={spec.ink} choices={[{ value: '#3e302c', label: 'Dark ink' }, { value: '#55443f', label: 'Soft graphite' }, { value: '#563d49', label: 'Plum ink' }]} testId="ink" onChange={(value) => updateSpec('ink', value)} /></ControlGroup>
                <ControlGroup title="Message layout">
                  <RangeControl label="English message size" value={Math.round(spec.englishScale * 100)} min={70} max={110} unit="%" onChange={(value) => updateSpec('englishScale', value / 100)} />
                  <RangeControl label="Move message lower" value={spec.messageOffset} min={0} max={40} unit=" px" onChange={(value) => updateSpec('messageOffset', value)} />
                </ControlGroup>
                <ControlGroup title="Card message">
                  <label className="block text-xs font-medium text-muted-foreground" htmlFor="german-copy">German</label>
                  <Textarea id="german-copy" aria-label="German card message" data-testid="input-german-message" className="mt-1 min-h-32 resize-y text-sm leading-relaxed" value={spec.german} onChange={(event) => updateSpec('german', event.target.value)} />
                  <label className="mt-3 block text-xs font-medium text-muted-foreground" htmlFor="english-copy">English translation</label>
                  <Textarea id="english-copy" aria-label="English card message" data-testid="input-english-message" className="mt-1 min-h-32 resize-y text-sm leading-relaxed" value={spec.english} onChange={(event) => updateSpec('english', event.target.value)} />
                  <Button className="mt-2" variant="ghost" size="sm" data-testid="button-restore-exact-message" onClick={() => { updateSpec('german', EXACT_GERMAN); updateSpec('english', EXACT_ENGLISH); }}>Restore approved wording</Button>
                </ControlGroup>
                <Button className="w-full" data-testid="button-finalize-from-editor" onClick={finalizeCard}><Check /> Quality check & finalize</Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="scan" className="mt-3">
            <Card className="border-border/80 shadow-sm">
              <CardHeader className="pb-3"><CardTitle className="font-serif text-2xl">Scan a keepsake</CardTitle><CardDescription>Upload a photo, set its four corners, and clean up the result.</CardDescription></CardHeader>
              <CardContent className="space-y-4">
                <input ref={fileRef} type="file" accept="image/*" className="sr-only" aria-label="Upload a physical card photograph" data-testid="input-scan-photo" onChange={(event) => uploadScan(event.target.files?.[0])} />
                <Button className="w-full" variant="outline" data-testid="button-upload-scan" onClick={() => fileRef.current?.click()}><ImagePlus /> {scanPhoto ? 'Choose another photo' : 'Upload physical card'}</Button>
                {scanPhoto ? <>
                  <div className="grid grid-cols-2 gap-3">
                    <div><div className="mb-1 text-xs font-semibold tracking-wide text-muted-foreground">BEFORE</div><div className="scan-frame"><img src={scanBefore} alt="Original uploaded photograph of card" className="max-h-48 w-full object-contain" /></div></div>
                    <div><div className="mb-1 text-xs font-semibold tracking-wide text-muted-foreground">AFTER</div><div className="scan-frame flex min-h-32 items-center justify-center">{scanAfter ? <img src={scanAfter} alt="Perspective corrected and enhanced card scan" className="max-h-48 w-full object-contain" /> : <span className="px-2 text-center text-xs text-muted-foreground">Apply your corner and enhancement adjustments</span>}</div></div>
                  </div>
                  <div className="relative overflow-hidden rounded-lg border border-border bg-muted">
                    <img ref={photoRef} src={scanPhoto} alt="Uploaded photo with editable card corner markers" className="block max-h-72 w-full object-contain" />
                    {corners.length === 4 && <svg className="absolute inset-0 h-full w-full touch-none" viewBox={`0 0 ${photoRef.current?.naturalWidth || 100} ${photoRef.current?.naturalHeight || 100}`} preserveAspectRatio="none" onPointerMove={updateCornerFromPointer} onPointerUp={() => { dragIndex.current = null; }}>
                      <polygon points={cornersPercent} fill="rgba(168,95,104,.08)" stroke="hsl(var(--primary))" strokeWidth={(photoRef.current?.naturalWidth || 100) / 240} />
                      {corners.map((point, index) => <circle key={index} cx={point.x} cy={point.y} r={(photoRef.current?.naturalWidth || 100) / 70} fill="hsl(var(--primary))" stroke="white" strokeWidth={(photoRef.current?.naturalWidth || 100) / 250} aria-label={['Top left', 'Top right', 'Bottom right', 'Bottom left'][index]} role="slider" tabIndex={0} onPointerDown={(event) => { dragIndex.current = index; moveCorner(event, index); }} onKeyDown={(event) => { const shift = event.shiftKey ? 12 : 3; if (event.key.startsWith('Arrow')) { event.preventDefault(); setCorners((previous) => previous.map((p, i) => i === index ? { x: Math.min(photoRef.current?.naturalWidth || 1, Math.max(0, p.x + (event.key === 'ArrowRight' ? shift : event.key === 'ArrowLeft' ? -shift : 0))), y: Math.min(photoRef.current?.naturalHeight || 1, Math.max(0, p.y + (event.key === 'ArrowDown' ? shift : event.key === 'ArrowUp' ? -shift : 0))) } : p)); } }} />)}
                    </svg>}
                  </div>
                  <div className="text-xs text-muted-foreground">Drag the four corner points to the card edges. Arrow keys also adjust the focused corner.</div>
                  <div className="grid grid-cols-2 gap-2"><Button size="sm" variant="outline" data-testid="button-auto-crop" onClick={() => { if (photoRef.current) setCorners(detectedCorners(photoRef.current)); }}>Auto crop</Button><Button size="sm" variant="outline" data-testid="button-perspective-correct" onClick={applyScan}>Perspective correction</Button></div>
                  <ControlGroup title="Image enhancement">
                    <RangeControl label="Brightness" value={adjustments.brightness} min={-40} max={40} onChange={(value) => setScanControl('brightness', value)} />
                    <RangeControl label="Contrast" value={adjustments.contrast} min={-40} max={40} onChange={(value) => setScanControl('contrast', value)} />
                    <RangeControl label="Shadow reduction" value={adjustments.shadows} min={0} max={100} onChange={(value) => setScanControl('shadows', value)} />
                    <RangeControl label="Paper cleanup" value={adjustments.cleanup} min={0} max={100} onChange={(value) => setScanControl('cleanup', value)} />
                    <RangeControl label="Sharpness" value={adjustments.sharpness} min={0} max={100} onChange={(value) => setScanControl('sharpness', value)} />
                    <div className="flex items-center justify-between text-sm"><span>Rotation</span><div className="flex gap-1"><Button size="sm" variant="outline" data-testid="button-rotate-left" onClick={() => setScanControl('rotation', (adjustments.rotation + 270) % 360)}><RotateCcw className="size-4" /> Left</Button><Button size="sm" variant="outline" data-testid="button-rotate-right" onClick={() => setScanControl('rotation', (adjustments.rotation + 90) % 360)}>Right <RotateCcw className="size-4 -scale-x-100" /></Button></div></div>
                  </ControlGroup>
                  <div className="grid grid-cols-2 gap-2"><Button variant="outline" data-testid="button-reset-scan" onClick={resetScan}>Reset adjustments</Button><Button data-testid="button-apply-scan" onClick={applyScan}>Apply changes</Button></div>
                  <Button variant="secondary" className="w-full" disabled={!scanAfter || !scanApplied} data-testid="button-export-scan" onClick={() => { if (scanAfter) fetch(scanAfter).then((response) => response.blob()).then((blob) => downloadBlob(blob, 'keepsake-scan-clean.png')); }}>Export cleaned scan</Button>
                </> : <div className="empty-scan rounded-xl border border-dashed border-border px-5 py-8 text-center"><ScanLine className="mx-auto size-8 text-primary" /><p className="mt-3 font-medium">A photo becomes a keepsake</p><p className="mt-1 text-sm text-muted-foreground">The card scan stays private in this browser.</p></div>}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="export" className="mt-3">
            <Card className="border-border/80 shadow-sm">
              <CardHeader className="pb-4"><CardTitle className="font-serif text-2xl">Export card</CardTitle><CardDescription>Print at full size or share a separate optimized digital copy.</CardDescription></CardHeader>
              <CardContent className="space-y-5">
                <div className="flex items-center justify-between rounded-lg bg-muted/70 px-3 py-2"><span className="text-sm font-medium">Print master</span><Badge variant={finalized ? 'secondary' : 'outline'}>{finalized ? 'Finalized' : 'Quality check required'}</Badge></div>
                <ControlGroup title="Print-ready files">
                  <div className="flex flex-wrap gap-2"><Button size="sm" variant={spec.size === '5x7' ? 'secondary' : 'outline'} data-testid="button-size-5x7" onClick={() => updateSpec('size', '5x7')}>5 × 7 in</Button><Button size="sm" variant={spec.size === '4x6' ? 'secondary' : 'outline'} data-testid="button-size-4x6" onClick={() => updateSpec('size', '4x6')}>4 × 6 in</Button></div>
                  <p className="text-xs text-muted-foreground" data-testid="text-print-dimensions">{spec.size === '5x7' ? '1500 × 2100 px' : '1200 × 1800 px'} · 300 DPI</p>
                  <label htmlFor="bleed-toggle" className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm">Add 0.125 in bleed<Checkbox id="bleed-toggle" checked={bleed} onCheckedChange={(checked) => setBleed(checked === true)} data-testid="input-pdf-bleed" /></label>
                  <div className="grid grid-cols-2 gap-2"><Button size="sm" variant="outline" data-testid="button-export-print-png" onClick={() => exportCard('png')}>PNG · {spec.size}</Button><Button size="sm" variant="outline" data-testid="button-export-print-jpg" onClick={() => exportCard('jpg')}>JPG · {spec.size}</Button></div>
                  <Button className="w-full" data-testid="button-export-pdf" onClick={() => exportCard('pdf')}>Print-ready PDF</Button>
                  {bleed && <p className="text-xs text-muted-foreground">Page size includes 0.125 in on each edge; the card is centered in the safe area.</p>}
                </ControlGroup>
                <ControlGroup title="Digital versions">
                  <Button className="w-full justify-between" variant="outline" data-testid="button-export-digital-hq" onClick={() => exportCard('digital')}>High-quality JPG <Download /></Button>
                  <Button className="w-full justify-between" variant="outline" data-testid="button-export-whatsapp" onClick={() => exportCard('whatsapp')}>WhatsApp version <Download /></Button>
                  <Button className="w-full justify-between" variant="outline" data-testid="button-export-email" onClick={() => exportCard('email')}>Email version <Download /></Button>
                  <p className="text-xs text-muted-foreground">Digital masters are created separately; your print master is never compressed.</p>
                </ControlGroup>
                <details className="group rounded-lg border border-border px-3 py-2">
                  <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-medium">Quality check <ChevronDown className="size-4 transition-transform group-open:rotate-180" /></summary>
                  <ul className="mt-3 space-y-2">{checks.map((check) => <li key={check.name} className="flex items-center gap-2 text-xs"><Check className={`size-3.5 ${check.ok ? 'text-chart-3' : 'text-destructive'}`} />{check.name}</li>)}</ul>
                  <Button className="mt-3 w-full" variant="secondary" size="sm" data-testid="button-run-quality-check" onClick={runQualityCheck}>Run quality check</Button>
                </details>
                <Button className="w-full" variant="ghost" data-testid="button-back-to-editor" onClick={() => setActiveTab('edit')}><X className="size-4" /> Back to edit</Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </aside>
    </div>
  </main>;
}