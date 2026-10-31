import React, { useLayoutEffect, useRef } from 'react';

export default function TierLabelEditor({ label, onChange, className, style, ariaLabel, maxLength = 16 }) {
    const editorRef = useRef(null);

    useLayoutEffect(() => {
        const editor = editorRef.current;
        if (!editor) return;
        const currentText = (editor.innerText || '').replace(/\r\n/g, '\n');
        if (currentText !== (label || '')) editor.innerText = label || '';
    }, [label]);

    const handleInput = event => {
        const editor = event.currentTarget;
        let nextLabel = (editor.innerText || '').replace(/\r\n/g, '\n');
        if (nextLabel.length > maxLength) {
            nextLabel = nextLabel.slice(0, maxLength);
            editor.innerText = nextLabel;
            const selection = window.getSelection();
            const range = document.createRange();
            range.selectNodeContents(editor);
            range.collapse(false);
            selection?.removeAllRanges();
            selection?.addRange(range);
        }
        onChange(nextLabel);
    };

    return (
        <div
            ref={editorRef}
            className={className}
            style={style}
            role="textbox"
            aria-label={ariaLabel}
            aria-multiline="true"
            contentEditable="plaintext-only"
            suppressContentEditableWarning
            spellCheck={false}
            onInput={handleInput}
        />
    );
}
