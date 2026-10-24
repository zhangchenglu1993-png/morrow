"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type EntryKind = "draft" | "private";

type PrivateEntry = {
  id: string;
  kind: EntryKind;
  body: string;
  createdAt: string;
  updatedAt: string;
};

const DB_NAME = "morrow-local";
const STORE_NAME = "entries";

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
        store.createIndex("kind", "kind");
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function listEntries(): Promise<PrivateEntry[]> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const request = db.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).getAll();
    request.onsuccess = () => {
      resolve(
        (request.result as PrivateEntry[]).sort((a, b) =>
          b.updatedAt.localeCompare(a.updatedAt)
        )
      );
    };
    request.onerror = () => reject(request.error);
  });
}

async function saveEntry(entry: PrivateEntry): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const request = db.transaction(STORE_NAME, "readwrite").objectStore(STORE_NAME).put(entry);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

async function removeEntry(id: string): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const request = db.transaction(STORE_NAME, "readwrite").objectStore(STORE_NAME).delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export function PrivateJournal() {
  const router = useRouter();
  const [tab, setTab] = useState<EntryKind>("draft");
  const [entries, setEntries] = useState<PrivateEntry[]>([]);
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    try {
      setEntries(await listEntries());
    } catch {
      setError("浏览器本地存储暂时不可用。");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function addEntry() {
    const text = body.trim();
    if (!text) return;
    const now = new Date().toISOString();
    const entry: PrivateEntry = {
      id: crypto.randomUUID(),
      kind: tab,
      body: text,
      createdAt: now,
      updatedAt: now
    };
    try {
      await saveEntry(entry);
      setBody("");
      await refresh();
    } catch {
      setError("没有保存成功。请联系管理员检查浏览器存储空间。");
    }
  }

  async function remove(id: string) {
    if (!window.confirm("确定删除这条本机记录吗？")) return;
    try {
      await removeEntry(id);
      await refresh();
    } catch {
      setError("删除失败，请稍后再试。");
    }
  }

  function takeToComposer(entry: PrivateEntry) {
    sessionStorage.setItem("morrow_private_draft", entry.body);
    router.push("/compose");
  }

  const visible = entries.filter((entry) => entry.kind === tab);

  return (
    <>
      <div className="local-note">
        <strong>只在本机</strong>
        <span>
          这里不会向服务器发送任何内容。换设备、换浏览器或清理浏览器数据后，记录会丢失，平台无法恢复。
        </span>
      </div>

      <div className="tabs" role="tablist" aria-label="私密区类型">
        <button
          className={`tab${tab === "draft" ? " active" : ""}`}
          type="button"
          role="tab"
          aria-selected={tab === "draft"}
          onClick={() => setTab("draft")}
        >
          尚未公开的草稿
        </button>
        <button
          className={`tab${tab === "private" ? " active" : ""}`}
          type="button"
          role="tab"
          aria-selected={tab === "private"}
          onClick={() => setTab("private")}
        >
          永远不公开的记录
        </button>
      </div>

      <div className="private-grid">
        <section className="private-editor">
          <p className="eyebrow">{tab === "draft" ? "Draft" : "Private"}</p>
          <h2 className="page-subtitle" style={{ marginTop: 0 }}>
            {tab === "draft" ? "先留在这里，想清楚再公开。" : "让真实感受有一个不需要解释的地方。"}
          </h2>
          <textarea
            className="field"
            style={{ minHeight: 220, width: "100%" }}
            value={body}
            maxLength={2000}
            placeholder={tab === "draft" ? "写下还没准备好公开的片段…" : "只有你能看见…"}
            onChange={(event) => setBody(event.target.value)}
          />
          <p className="field-hint">{body.length} / 2,000 字</p>
          <button className="button button-primary" type="button" disabled={!body.trim()} onClick={() => void addEntry()}>
            {tab === "draft" ? "存为草稿" : "留在私密区"}
          </button>
          {error ? <p className="form-error">{error}</p> : null}
        </section>

        <section>
          <div className="section-heading">
            <div>
              <h2 style={{ fontSize: "1.5rem" }}>
                {tab === "draft" ? "草稿" : "私人记录"}
              </h2>
              <p>{visible.length} 条，保存在当前浏览器。</p>
            </div>
          </div>
          {loading ? (
            <p className="field-hint">正在打开本地空间…</p>
          ) : visible.length > 0 ? (
            <div className="private-list">
              {visible.map((entry) => (
                <article className="private-entry" key={entry.id}>
                  <p>{entry.body}</p>
                  <footer>
                    <span>{new Date(entry.updatedAt).toLocaleString("zh-CN")}</span>
                    <span style={{ display: "flex", gap: 8 }}>
                      {entry.kind === "draft" ? (
                        <button
                          className="button button-ghost button-small"
                          type="button"
                          onClick={() => takeToComposer(entry)}
                        >
                          去公开
                        </button>
                      ) : null}
                      <button className="text-button" type="button" onClick={() => void remove(entry.id)}>
                        删除
                      </button>
                    </span>
                  </footer>
                </article>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <h3>{tab === "draft" ? "还没有草稿" : "这里还没有记录"}</h3>
              <p>文字只留在当前浏览器里，不会自动同步。</p>
            </div>
          )}
        </section>
      </div>
    </>
  );
}
