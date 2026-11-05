'use client';

import { useEffect } from 'react';
import { useForm } from '@payloadcms/ui';

const frontend = 'http://localhost:3000';
const allowed = /^(title|headline|intro|overview|brief|approach|outcome|about|previewURL|facts\.(industry|created|pages|platform)|(?:pages|features)\.\d+\.label|copy\.\d+\.value|sections\.\d+\.(?:heading|content\.\d+\.(?:label|text|link)))$/;

export function VisualEditBridge() {
  const { dispatchFields, getDataByPath, setModified, disabled } = useForm();
  useEffect(() => {
    function receive(event: MessageEvent) {
      const iframe = document.querySelector<HTMLIFrameElement>('#live-preview-iframe');
      const message = event.data;
      if (disabled || !iframe || event.source !== iframe.contentWindow || event.origin !== frontend ||
          message?.type !== 'relyon-visual-edit' || typeof message.path !== 'string' ||
          !allowed.test(message.path) || typeof message.value !== 'string' ||
          message.value.length > 100_000) return;
      const previous = getDataByPath(message.path);
      if (typeof previous !== 'string' || previous !== message.previous) {
        iframe.contentWindow?.postMessage({type:'relyon-visual-edit-result',ok:false},frontend);
        return;
      }
      if (message.value !== previous) {
        dispatchFields({type:'UPDATE',path:message.path,value:message.value});
        setModified(true);
      }
      iframe.contentWindow?.postMessage({type:'relyon-visual-edit-result',ok:true},frontend);
    }
    window.addEventListener('message', receive);
    return () => window.removeEventListener('message', receive);
  }, [disabled,dispatchFields,getDataByPath,setModified]);
  return null;
}
