"use client";

import { useEffect, useRef, useState } from "react";

import { SubmitButton } from "@/components/submit-button";

type Aspect = "original" | "square" | "landscape" | "portrait";
type Props = { name: string; label: string; required?: boolean; kind: "gallery" | "logo"; existingUrl?: string; displayUrl?: string; allowReplacement?: boolean; saveCropSeparately?: boolean; compact?: "cover" | "avatar" | "logo" };

function stageSize(aspect: Aspect, width: number, height: number) {
  if (aspect === "square") return { width: 360, height: 360 };
  if (aspect === "landscape") return { width: 480, height: 360 };
  if (aspect === "portrait") return { width: 270, height: 360 };
  const ratio = width / height;
  return ratio >= 1 ? { width: 480, height: Math.max(120, Math.round(480 / ratio)) } : { width: Math.max(120, Math.round(360 * ratio)), height: 360 };
}

function drawCrop(canvas: HTMLCanvasElement, image: HTMLImageElement, zoom: number, offset: { x: number; y: number }, outputScale = 1) {
  const context = canvas.getContext("2d");
  if (!context) return;
  const width = canvas.width;
  const height = canvas.height;
  const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight) * zoom;
  const x = Math.max(-((image.naturalWidth * scale - width) / 2), Math.min((image.naturalWidth * scale - width) / 2, offset.x * outputScale));
  const y = Math.max(-((image.naturalHeight * scale - height) / 2), Math.min((image.naturalHeight * scale - height) / 2, offset.y * outputScale));
  context.clearRect(0, 0, width, height);
  context.drawImage(image, (width - image.naturalWidth * scale) / 2 + x, (height - image.naturalHeight * scale) / 2 + y, image.naturalWidth * scale, image.naturalHeight * scale);
}

export function CroppableImageInput({ name, label, required, kind, existingUrl, displayUrl, allowReplacement = false, saveCropSeparately = true, compact }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const committedRef = useRef<File | null>(null);
  const dragRef = useRef<{ x: number; y: number } | null>(null);
  const [selected, setSelected] = useState<File | null>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [aspect, setAspect] = useState<Aspect>("original");
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const size = stageSize(aspect, dimensions.width || 1, dimensions.height || 1);
  const logoHint = kind === "logo" ? <span className="logo-upload-hint"> (transparent PNG recommended)</span> : null;

  useEffect(() => {
    if (!selected) return;
    const url = URL.createObjectURL(selected);
    const image = new window.Image();
    image.onload = () => {
      imageRef.current = image;
      setDimensions({ width: image.naturalWidth, height: image.naturalHeight });
      setError("");
    };
    image.onerror = () => setError("This image could not be opened. Please choose another JPG, PNG, or WebP file.");
    image.src = url;
    return () => { image.onload = null; image.onerror = null; URL.revokeObjectURL(url); imageRef.current = null; };
  }, [selected]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas && imageRef.current && dimensions.width) drawCrop(canvas, imageRef.current, zoom, offset);
  }, [dimensions, aspect, zoom, offset]);

  useEffect(() => {
    if (!selected) return;
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") cancel(); };
    const form = inputRef.current?.form;
    const preventSubmit = (event: Event) => event.preventDefault();
    window.addEventListener("keydown", onKeyDown);
    form?.addEventListener("submit", preventSubmit, true);
    return () => { window.removeEventListener("keydown", onKeyDown); form?.removeEventListener("submit", preventSubmit, true); };
  // The handler only needs to react to whether a crop dialog is open.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  function setInputFile(file: File | null) {
    if (!inputRef.current) return;
    const transfer = new DataTransfer();
    if (file) transfer.items.add(file);
    inputRef.current.files = transfer.files;
  }

  function cancel() {
    setSelected(null);
    setDimensions({ width: 0, height: 0 });
    setInputFile(committedRef.current);
  }

  async function openExisting() {
    if (!existingUrl || preparing) return;
    if (committedRef.current) { setSelected(committedRef.current); return; }
    setPreparing(true);
    setError("");
    try {
      const response = await fetch(existingUrl);
      if (!response.ok) throw new Error("Could not load this photo for cropping. Please try again.");
      const blob = await response.blob();
      if (!["image/jpeg", "image/png", "image/webp"].includes(blob.type)) throw new Error("This photo format cannot be cropped here.");
      setAspect("original"); setZoom(1); setOffset({ x: 0, y: 0 }); setDimensions({ width: 0, height: 0 });
      setSelected(new File([blob], `gallery-photo.${blob.type.split("/")[1]}`, { type: blob.type }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load this photo.");
    } finally {
      setPreparing(false);
    }
  }

  async function applyCrop() {
    if (!imageRef.current || !canvasRef.current || !inputRef.current) return;
    setSaving(true);
    setError("");
    try {
      const maxSide = kind === "logo" ? 1000 : 1600;
      const ratio = Math.min(maxSide / Math.max(size.width, size.height), 4);
      const output = document.createElement("canvas");
      output.width = Math.round(size.width * ratio);
      output.height = Math.round(size.height * ratio);
      drawCrop(output, imageRef.current, zoom, offset, ratio);
      const blob = await new Promise<Blob | null>((resolve) => output.toBlob(resolve, "image/webp", 0.82));
      if (!blob) throw new Error("Could not crop this image. Please try another file.");
      const limit = kind === "logo" ? 2 : 8;
      if (blob.size > limit * 1024 * 1024) throw new Error(`Cropped image is over ${limit} MB. Try a smaller crop.`);
      const mimeType = blob.type === "image/webp" ? "image/webp" : "image/png";
      const extension = mimeType === "image/webp" ? "webp" : "png";
      const file = new File([blob], `${selected?.name.replace(/\.[^.]+$/, "") || name}-cropped.${extension}`, { type: mimeType });
      committedRef.current = file;
      setInputFile(file);
      setPreview(URL.createObjectURL(blob));
      setSelected(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not crop this image.");
    } finally {
      setSaving(false);
    }
  }

  return <div className={`form-field crop-field${compact ? ` crop-field--${compact}` : ""}`}>
    {existingUrl ? <>
      <button className="admin-gallery-image-button" type="button" onClick={openExisting} disabled={preparing} aria-label={preparing ? "Opening photo for cropping" : label}>
        {/* Gallery thumbnails and local blob previews already have the correct size. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={preview || displayUrl || existingUrl} alt="" />
        <span>{preparing ? "Opening photo…" : "Crop photo"}</span>
      </button>
      {allowReplacement ? <><label htmlFor={`${name}-upload`}>Replace {label.toLowerCase()}{logoHint}</label><input ref={inputRef} id={`${name}-upload`} className="field-input" name={name} type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => {
        const file = event.target.files?.[0];
        if (!file) return;
        committedRef.current = null; setPreview(null); setAspect("original"); setZoom(1); setOffset({ x: 0, y: 0 }); setDimensions({ width: 0, height: 0 }); setError(""); setSelected(file);
      }} /></> : <input ref={inputRef} name={name} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" tabIndex={-1} aria-hidden="true" />}
      {preview && (saveCropSeparately ? <SubmitButton className="btn btn-lime btn-small" pendingLabel="Saving crop…">Save crop</SubmitButton> : <span className="crop-ready">Crop ready. Save changes to apply it.</span>)}
    </> : <>
      <label htmlFor={`${name}-upload`}>{label}{logoHint}</label>
      <input ref={inputRef} id={`${name}-upload`} className="field-input" name={name} type="file" accept="image/jpeg,image/png,image/webp" required={required} onChange={(event) => {
        const file = event.target.files?.[0];
        if (!file) return;
        setAspect("original"); setZoom(1); setOffset({ x: 0, y: 0 }); setDimensions({ width: 0, height: 0 }); setError(""); setSelected(file);
      }} />
    </>}
    {preview && !existingUrl && <div className="crop-result">
      {/* Blob URLs are generated locally and cannot use the Next image optimizer. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={preview} alt="Cropped upload preview" />
      <span>Crop ready to upload</span><button type="button" className="text-button" onClick={() => setSelected(committedRef.current)}>Adjust crop</button>
    </div>}
    {error && !selected && <p className="form-error" role="alert">{error}</p>}
    {selected && <div className="crop-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) cancel(); }}>
      <div className="crop-dialog" role="dialog" aria-modal="true" aria-label={`Crop ${label.toLowerCase()}`}>
        <div className="crop-heading"><div><h2>Crop your {kind === "logo" ? "logo" : "photo"}.</h2><p>Drag to position the image. Choose a shape and zoom as needed.</p></div><button type="button" className="crop-close" onClick={cancel} aria-label="Close crop tool">×</button></div>
        <div className="crop-stage">
          {dimensions.width ? <canvas ref={canvasRef} width={size.width} height={size.height} style={{ aspectRatio: `${size.width} / ${size.height}` }} onPointerDown={(event) => { dragRef.current = { x: event.clientX, y: event.clientY }; event.currentTarget.setPointerCapture(event.pointerId); }} onPointerMove={(event) => {
            if (!dragRef.current) return;
            const scale = size.width / event.currentTarget.getBoundingClientRect().width;
            const dx = (event.clientX - dragRef.current.x) * scale;
            const dy = (event.clientY - dragRef.current.y) * scale;
            const image = imageRef.current;
            const fit = image ? Math.max(size.width / image.naturalWidth, size.height / image.naturalHeight) * zoom : 1;
            const maxX = image ? Math.max(0, (image.naturalWidth * fit - size.width) / 2) : 0;
            const maxY = image ? Math.max(0, (image.naturalHeight * fit - size.height) / 2) : 0;
            setOffset((current) => ({ x: Math.max(-maxX, Math.min(maxX, current.x + dx)), y: Math.max(-maxY, Math.min(maxY, current.y + dy)) }));
            dragRef.current = { x: event.clientX, y: event.clientY };
          }} onPointerUp={() => { dragRef.current = null; }} onPointerCancel={() => { dragRef.current = null; }} /> : <span>Preparing image…</span>}
        </div>
        <div className="crop-controls"><div className="crop-aspects" aria-label="Crop shape">{(["original", "square", "landscape", "portrait"] as const).map((item) => <button key={item} type="button" className={aspect === item ? "active" : ""} aria-pressed={aspect === item} onClick={() => { setAspect(item); setZoom(1); setOffset({ x: 0, y: 0 }); }}>{item}</button>)}</div><label>Zoom <input type="range" min="1" max="3" step="0.01" value={zoom} onChange={(event) => { setZoom(Number(event.target.value)); setOffset({ x: 0, y: 0 }); }} /></label></div>
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="crop-actions"><button type="button" className="btn btn-outline" onClick={cancel}>Cancel</button><button type="button" className="btn btn-lime" disabled={!dimensions.width || saving} onClick={applyCrop}>{saving ? <><span className="button-spinner" aria-hidden="true" />Saving crop…</> : "Use this crop"}</button></div>
      </div>
    </div>}
  </div>;
}
