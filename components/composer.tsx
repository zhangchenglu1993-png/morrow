"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { mutationFetch, readApiError } from "@/lib/client";

type Preview = { file: File; url: string };

export function Composer({
  promptDay,
  promptQuestion
}: {
  promptDay: number;
  promptQuestion: string;
}) {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const [body, setBody] = useState("");
  const [previews, setPreviews] = useState<Preview[]>([]);
  const [respondToPrompt, setRespondToPrompt] = useState(true);
  const [originalityConfirmed, setOriginalityConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draftNotice, setDraftNotice] = useState(false);

  useEffect(() => {
    const draft = sessionStorage.getItem("morrow_private_draft");
    if (draft) {
      setBody(draft);
      setDraftNotice(true);
      sessionStorage.removeItem("morrow_private_draft");
    }
  }, []);

  useEffect(() => {
    return () => {
      for (const preview of previews) URL.revokeObjectURL(preview.url);
    };
  }, [previews]);

  function addFiles(files: FileList | null) {
    if (!files) return;
    const incoming = [...files];
    const existing = previews.map((preview) => preview.file);
    const next = [...existing, ...incoming];
    if (next.length > 6) {
      setError("每篇内容最多 6 张图片或 1 个视频。");
      return;
    }
    const images = next.filter((file) => file.type.startsWith("image/"));
    const videos = next.filter((file) => file.type.startsWith("video/"));
    if (images.length > 0 && videos.length > 0) {
      setError("一条内容不能同时包含图片和视频。");
      return;
    }
    if (videos.length > 1) {
      setError("一条内容最多包含 1 个视频。");
      return;
    }
    for (const file of incoming) {
      if (!["image/jpeg", "image/png", "image/webp", "video/mp4", "video/webm"].includes(file.type)) {
        setError("只支持 JPG、PNG、WebP、MP4 或 WebM 文件。");
        return;
      }
      if (file.type.startsWith("image/") && file.size > 15 * 1024 * 1024) {
        setError("单张图片不能超过 15 MB。");
        return;
      }
      if (file.type.startsWith("video/") && file.size > 100 * 1024 * 1024) {
        setError("视频不能超过 100 MB。");
        return;
      }
    }
    setError(null);
    setPreviews((current) => [
      ...current,
      ...incoming.map((file) => ({ file, url: URL.createObjectURL(file) }))
    ]);
    if (fileInput.current) fileInput.current.value = "";
  }

  function removePreview(index: number) {
    setPreviews((current) => {
      const target = current[index];
      if (target) URL.revokeObjectURL(target.url);
      return current.filter((_, currentIndex) => currentIndex !== index);
    });
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!originalityConfirmed) {
      setError("请先确认内容来自你的真实生活，且没有使用 AI 生成。");
      return;
    }
    setBusy(true);
    setError(null);
    const form = new FormData();
    form.set("body", body);
    form.set("promptDay", respondToPrompt ? String(promptDay) : "");
    form.set("originalityConfirmed", "true");
    for (const preview of previews) form.append("media", preview.file);
    try {
      const response = await mutationFetch("/api/posts", {
        method: "POST",
        body: form
      });
      if (!response.ok) {
        setError(await readApiError(response));
        return;
      }
      const data = (await response.json()) as { postId: string };
      router.push(`/p/${data.postId}`);
      router.refresh();
    } catch {
      setError("网络没有连上，请稍后再试。");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="form-stack" onSubmit={(event) => void submit(event)}>
      {draftNotice ? (
        <p className="form-success">已把本机草稿带到这里。确认后才会公开上传。</p>
      ) : null}
      <div className="composer-card">
        <label className="field">
          <span className="field-label">记录此刻</span>
          <textarea
            className="composer-textarea"
            value={body}
            maxLength={2000}
            placeholder="今天有什么值得被记住？可以是一句话，也可以是一段故事。"
            onChange={(event) => setBody(event.target.value)}
            autoFocus
          />
        </label>

        {previews.length > 0 ? (
          <div className="preview-grid">
            {previews.map((preview, index) => (
              <div className="preview-item" key={`${preview.file.name}-${index}`}>
                {preview.file.type.startsWith("video/") ? (
                  <video src={preview.url} muted playsInline />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={preview.url} alt={`待发布图片 ${index + 1}`} />
                )}
                <button
                  className="preview-remove"
                  type="button"
                  aria-label="移除这个文件"
                  onClick={() => removePreview(index)}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        ) : null}

        <div className="composer-toolbar">
          <label className="file-picker">
            + 照片或视频
            <input
              ref={fileInput}
              type="file"
              accept="image/jpeg,image/png,image/webp,video/mp4,video/webm"
              multiple
              onChange={(event) => addFiles(event.target.files)}
            />
          </label>
          <span className="field-hint">{body.length} / 2,000 字</span>
        </div>
      </div>

      <div className="composer-card">
        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={respondToPrompt}
            onChange={(event) => setRespondToPrompt(event.target.checked)}
          />
          <span>
            回应第 {promptDay} 天：{promptQuestion}
          </span>
        </label>
        <label className="checkbox-row" style={{ marginTop: 14 }}>
          <input
            type="checkbox"
            checked={originalityConfirmed}
            onChange={(event) => setOriginalityConfirmed(event.target.checked)}
          />
          <span>
            我确认这是自己的真实生活记录，文字、图片和视频均非 AI 生成，也没有发布广告、新闻、政治或负面内容。
          </span>
        </label>
      </div>

      {error ? <p className="form-error">{error}</p> : null}
      <div className="compose-submit-row">
        <p>发布后会立即进入广场，并接受所有成员的共同反馈。</p>
        <button className="button button-primary" type="submit" disabled={busy || !originalityConfirmed}>
          {busy ? "正在发布…" : "公开这份美好"}
        </button>
      </div>
    </form>
  );
}
