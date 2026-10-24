'use client';

import { useEffect, useId, useRef, type ReactNode } from 'react';
import styles from './toys.module.css';

export default function ToyDialog({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  const titleId = useId();
  useEffect(() => {
    const element = dialog.current!;
    const previous = document.activeElement as HTMLElement | null;
    element.showModal();
    return () => { element.close(); if (previous?.isConnected) previous.focus({ preventScroll: true }); };
  }, []);
  return <dialog ref={dialog} className={styles.dialog} aria-labelledby={titleId} onKeyDown={event => {
    if (event.key !== 'Tab') return;
    const controls = [...event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input, select, textarea, [tabindex="0"]')];
    const first = controls[0], last = controls[controls.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  }} onCancel={event => { event.preventDefault(); close.current(); }} onClick={event => { if (event.target === event.currentTarget) close.current(); }}>
    <div className={styles.dialogInner}>
      <div className={styles.dialogHeading}><h3 id={titleId}>{title}</h3><button autoFocus type="button" className={styles.close} onClick={onClose} aria-label="关闭弹窗">×</button></div>
      {children}
    </div>
  </dialog>;
}
