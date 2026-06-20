import { Clipboard, ExternalLink, Image, Paperclip, Trash2, Upload, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { ContentAttachment } from '../domain/types';

const MAX_FILES = 10;
const MAX_FILE_SIZE = 2 * 1024 * 1024;
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

type ScreenshotPickerProps = {
  files: File[];
  onChange: (files: File[]) => void;
  existing?: ContentAttachment[];
  onDeleteExisting?: (attachmentId: string) => void | Promise<void>;
};

export function ScreenshotPicker({
  files,
  onChange,
  existing = [],
  onDeleteExisting,
}: ScreenshotPickerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const previews = useMemo(
    () => files.map((file) => ({ file, url: URL.createObjectURL(file) })),
    [files],
  );

  useEffect(() => () => {
    previews.forEach((preview) => URL.revokeObjectURL(preview.url));
  }, [previews]);

  const appendFiles = (incoming: File[]) => {
    const images = incoming.filter((file) => ALLOWED_TYPES.includes(file.type));
    if (images.length !== incoming.length) {
      setError('Разрешены только изображения PNG, JPEG и WebP.');
      return;
    }
    if (images.some((file) => !file.size || file.size > MAX_FILE_SIZE)) {
      setError('Размер одного скриншота не должен превышать 2 МБ.');
      return;
    }
    if (existing.length + files.length + images.length > MAX_FILES) {
      setError(`К одной карточке можно прикрепить не больше ${MAX_FILES} скриншотов.`);
      return;
    }
    setError(null);
    onChange([...files, ...images]);
  };

  return (
    <div className="content-attachment-picker">
      <div
        role="button"
        tabIndex={0}
        className="content-attachment-dropzone"
        onClick={() => inputRef.current?.click()}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') inputRef.current?.click();
        }}
        onPaste={(event) => {
          const pasted = Array.from(event.clipboardData.files);
          if (pasted.length) {
            event.preventDefault();
            appendFiles(pasted);
          }
        }}
      >
        <Clipboard className="h-5 w-5" />
        <div>
          <strong>Вставьте скриншот сюда</strong>
          <span>Нажмите Ctrl+V или выберите файлы. До 10 изображений, каждое до 2 МБ.</span>
        </div>
        <Upload className="h-5 w-5" />
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        multiple
        className="sr-only"
        onChange={(event) => {
          appendFiles(Array.from(event.target.files ?? []));
          event.currentTarget.value = '';
        }}
      />
      {error && <p className="content-attachment-error">{error}</p>}

      {(existing.length > 0 || previews.length > 0) && (
        <div className="content-attachment-previews">
          {existing.map((attachment) => (
            <div key={attachment.id} className="content-attachment-preview">
              <img src={attachment.url} alt={attachment.fileName} loading="lazy" />
              <span>{attachment.fileName}</span>
              {onDeleteExisting && (
                <button
                  type="button"
                  onClick={() => void onDeleteExisting(attachment.id)}
                  aria-label={`Удалить ${attachment.fileName}`}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}
          {previews.map(({ file, url }, index) => (
            <div key={`${file.name}-${file.lastModified}-${index}`} className="content-attachment-preview">
              <img src={url} alt={file.name} />
              <span>{file.name}</span>
              <button
                type="button"
                onClick={() => onChange(files.filter((_, fileIndex) => fileIndex !== index))}
                aria-label={`Убрать ${file.name}`}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function ContentMediaActions({
  attachments = [],
  videoUrl,
}: {
  attachments?: ContentAttachment[];
  videoUrl?: string | null;
}) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const activeAttachment = activeIndex === null ? null : attachments[activeIndex];

  useEffect(() => {
    if (activeIndex === null) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setActiveIndex(null);
      if (event.key === 'ArrowLeft') {
        setActiveIndex((current) => current === null ? null : (current - 1 + attachments.length) % attachments.length);
      }
      if (event.key === 'ArrowRight') {
        setActiveIndex((current) => current === null ? null : (current + 1) % attachments.length);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeIndex, attachments.length]);

  if (!attachments.length && !videoUrl) return null;

  return (
    <>
      <div className="content-media-actions">
        {attachments.length > 0 && (
          <button type="button" onClick={() => setActiveIndex(0)} className="content-media-button">
            <Image className="h-4 w-4" />
            Посмотреть скриншоты ({attachments.length})
          </button>
        )}
        {videoUrl && (
          <a href={videoUrl} target="_blank" rel="noreferrer" className="content-media-button">
            <ExternalLink className="h-4 w-4" />
            Открыть видео
          </a>
        )}
      </div>

      {activeAttachment && (
        <div className="content-gallery-backdrop" role="presentation" onMouseDown={() => setActiveIndex(null)}>
          <div
            className="content-gallery"
            role="dialog"
            aria-modal="true"
            aria-label="Просмотр скриншотов"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="content-gallery-header">
              <div className="min-w-0">
                <strong>{activeAttachment.fileName}</strong>
                <span>{(activeIndex ?? 0) + 1} из {attachments.length}</span>
              </div>
              <button type="button" onClick={() => setActiveIndex(null)} aria-label="Закрыть">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="content-gallery-stage">
              {attachments.length > 1 && (
                <button
                  type="button"
                  className="content-gallery-nav content-gallery-nav-left"
                  onClick={() => setActiveIndex((activeIndex - 1 + attachments.length) % attachments.length)}
                  aria-label="Предыдущий скриншот"
                >
                  <ChevronLeft className="h-6 w-6" />
                </button>
              )}
              <img src={activeAttachment.url} alt={activeAttachment.fileName} />
              {attachments.length > 1 && (
                <button
                  type="button"
                  className="content-gallery-nav content-gallery-nav-right"
                  onClick={() => setActiveIndex((activeIndex + 1) % attachments.length)}
                  aria-label="Следующий скриншот"
                >
                  <ChevronRight className="h-6 w-6" />
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export function MediaFields({
  videoUrl,
  onVideoUrlChange,
  files,
  onFilesChange,
  existing,
  onDeleteExisting,
}: {
  videoUrl: string;
  onVideoUrlChange: (value: string) => void;
  files: File[];
  onFilesChange: (files: File[]) => void;
  existing?: ContentAttachment[];
  onDeleteExisting?: (attachmentId: string) => void | Promise<void>;
}) {
  return (
    <div className="content-media-fields">
      <label>
        <span><ExternalLink className="h-4 w-4" /> Ссылка на видео</span>
        <input
          type="url"
          value={videoUrl}
          onChange={(event) => onVideoUrlChange(event.target.value)}
          className="field"
          placeholder="https://..."
        />
      </label>
      <div>
        <span className="content-media-label"><Paperclip className="h-4 w-4" /> Скриншоты</span>
        <ScreenshotPicker
          files={files}
          onChange={onFilesChange}
          existing={existing}
          onDeleteExisting={onDeleteExisting}
        />
      </div>
    </div>
  );
}
