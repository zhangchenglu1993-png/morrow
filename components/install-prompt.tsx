"use client";

import { useEffect, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_KEY = "morrow-install-dismissed-at";

export function InstallPrompt() {
  const [visible, setVisible] = useState(false);
  const [ios, setIos] = useState(false);
  const [showSteps, setShowSteps] = useState(false);
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    if (window.matchMedia("(display-mode: standalone)").matches) return;
    if (!window.matchMedia("(max-width: 820px)").matches) return;

    const dismissedAt = Number(window.localStorage.getItem(DISMISS_KEY) || 0);
    if (Date.now() - dismissedAt < 14 * 86_400_000) return;

    const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent);
    setIos(isIos);

    const onPrompt = (event: Event) => {
      event.preventDefault();
      setDeferred(event as BeforeInstallPromptEvent);
      setVisible(true);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);

    const onInstalled = () => setVisible(false);
    window.addEventListener("appinstalled", onInstalled);

    const timer = window.setTimeout(() => {
      setVisible(true);
    }, 2500);

    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
      window.clearTimeout(timer);
    };
  }, []);

  function dismiss() {
    window.localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setVisible(false);
  }

  async function install() {
    if (!deferred) {
      setShowSteps((value) => !value);
      return;
    }
    await deferred.prompt();
    const choice = await deferred.userChoice;
    if (choice.outcome === "accepted") {
      setVisible(false);
      return;
    }
    dismiss();
  }

  if (!visible) return null;

  return (
    <div className="install-banner" role="dialog" aria-label="安装 Morrow">
      <span className="install-icon" aria-hidden="true">🌱</span>
      <div className="install-body">
        <strong>把 Morrow 放到主屏幕</strong>
        <span>以后点一下图标就能进来，不用再找链接。</span>
        {showSteps ? (
          <span className="install-steps">
            {ios
              ? "在 Safari 底部点「分享」，选择「添加到主屏幕」，再点「添加」。"
              : "在浏览器右上角菜单里选择「添加到主屏幕」或「安装应用」。"}
          </span>
        ) : null}
      </div>
      <div className="install-actions">
        <button className="button button-primary button-small" type="button" onClick={() => void install()}>
          {deferred ? "安装" : "怎么添加"}
        </button>
        <button className="install-close" type="button" aria-label="暂时不要" onClick={dismiss}>
          ×
        </button>
      </div>
    </div>
  );
}
