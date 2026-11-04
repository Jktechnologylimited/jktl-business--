"use client";
import { useEffect } from "react";
export function WebsiteChat({
  botId,
  origin = "https://business.jktl.com.ng",
}: {
  botId: string;
  origin?: string;
}) {
  useEffect(() => {
    const script = document.createElement("script");
    script.src = origin + "/chatbots/widget.js";
    script.dataset.chatbotId = botId;
    script.async = true;
    document.body.appendChild(script);
    return () => {
      script.dataset.jktlCancelled = "true";
      script.remove();
      document
        .querySelector('[data-jktl-chatbot-host="' + botId + '"]')
        ?.dispatchEvent(new Event("jktl-chat-destroy"));
    };
  }, [botId, origin]);
  return null;
}
