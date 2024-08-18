import React, { useEffect, useRef, useState } from 'react';
import { LexicalComposer } from '@lexical/react/LexicalComposer';
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import io from 'socket.io-client';
import * as Y from 'yjs';

const socket = io('http://localhost:3001', {
    transports: ['websocket'],  // 强制使用 WebSocket 传输
    reconnectionAttempts: 5,    // 尝试重新连接
    reconnectionDelay: 1000,    // 每次重连之间的延迟时间
});

const initialConfig = {
    namespace: 'MyEditor',
    theme: {}, // 自定义主题
    onError: (error) => {
        console.error(error);
    },
};

const defaultEditorState = {
    root: {
        children: [
            {
                type: 'paragraph',
                children: [
                    { type: 'text', text: 'hello' }
                ]
            }
        ],
        type: 'root',
    }
};

const EditorComponent = () => {
    const [editor] = useLexicalComposerContext();
    const ydocRef = useRef(new Y.Doc());
    const [initialized, setInitialized] = useState(false);
    const isUpdatingFromYjs = useRef(false); // 标志位：是否由 Yjs 触发更新

    useEffect(() => {
        const ydoc = ydocRef.current;
        const yText = ydoc.getText('document');

        // 同步来自服务器的初始内容
        socket.on('sync-update', (update) => {
            Y.applyUpdate(ydoc, new Uint8Array(update));
            if (!initialized) {
                editor.update(() => {
                    const textContent = yText.toString();
                    if (textContent) {
                        try {
                            const content = JSON.parse(textContent);
                            isUpdatingFromYjs.current = true; // 设置标志位，避免循环
                            editor.setEditorState(editor.parseEditorState(content));
                            isUpdatingFromYjs.current = false;
                            setInitialized(true);
                        } catch (error) {
                            console.error('Failed to parse JSON:', error);
                            editor.setEditorState(editor.parseEditorState(defaultEditorState));
                            setInitialized(true);
                        }
                    } else {
                        editor.setEditorState(editor.parseEditorState(defaultEditorState));
                        setInitialized(true);
                    }
                });
            }
        });

        // 监听服务器的实时更新
        socket.on('update', (update) => {
            Y.applyUpdate(ydoc, new Uint8Array(update));

            if (!isUpdatingFromYjs.current) {
                editor.update(() => {
                    const textContent = yText.toString();
                    if (textContent) {
                        try {
                            isUpdatingFromYjs.current = true; // 设置标志位，避免循环
                            const content = JSON.parse(textContent);
                            editor.setEditorState(editor.parseEditorState(content));
                            isUpdatingFromYjs.current = false;
                        } catch (error) {
                            console.error('Failed to parse JSON during update:', error);
                        }
                    }
                });
            }
        });

        // 注册编辑器的更新监听器，将内容同步到 Yjs 文档
        const unregister = editor.registerUpdateListener(({ editorState }) => {
            if (!isUpdatingFromYjs.current) { // 仅在非 Yjs 触发时进行处理
                editorState.read(() => {
                    const editorContent = editorState.toJSON(); // 序列化编辑器内容
                    const newContent = JSON.stringify(editorContent);
                    if (newContent !== yText.toString()) {
                        yText.delete(0, yText.length); // 清空 Yjs 文本
                        yText.insert(0, newContent);   // 插入新的内容
                        const encodedState = Y.encodeStateAsUpdate(ydoc);
                        socket.emit('update', encodedState); // 发送更新到服务器
                    }
                });
            }
        });

        socket.on('connect_error', (err) => {
            console.error('Connection error:', err);
        });

        socket.on('disconnect', (reason) => {
            console.log('Socket disconnected:', reason);
        });

        return () => {
            unregister(); // 注销编辑器的更新监听器
            // socket.disconnect(); // 移除不必要的主动断开调用，除非组件卸载
        };
    }, [editor, initialized]);

    return <ContentEditable className="editor" />;
};

const CollaborativeEditor = () => {
    return (
        <LexicalComposer initialConfig={initialConfig}>
            <div className="editor-container">
                <RichTextPlugin
                    contentEditable={<EditorComponent />}
                    placeholder={<div className="editor-placeholder">Start typing...</div>}
                />
                <HistoryPlugin />
            </div>
        </LexicalComposer>
    );
};

export default CollaborativeEditor;
