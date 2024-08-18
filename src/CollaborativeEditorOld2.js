import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { LexicalComposer } from '@lexical/react/LexicalComposer';
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $getNodeByKey, $getSelection, $isRangeSelection, $getRoot, $createTextNode } from 'lexical';
import io from 'socket.io-client';
import * as Y from 'yjs';
import debounce from 'lodash.debounce';

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

const CollaborativeCursorPlugin = React.memo(({ userId, userName, color }) => {
    const [editor] = useLexicalComposerContext();
    const [cursorPositions, setCursorPositions] = useState({});

    useEffect(() => {
        // 监听编辑器的光标位置变化
        const unregister = editor.registerUpdateListener(() => {

            editor.update(() => {
                const selection = $getSelection();

                if ($isRangeSelection(selection)) {

                    const { anchor } = selection;

                    const cursorData = {
                        userId,
                        userName,
                        anchorOffset: anchor.offset,
                        anchorKey: anchor.key,
                        color,
                    };
                    socket.emit('cursor-update', cursorData);
                }
            })
        });

        // 监听其他用户的光标更新
        socket.on('cursor-update', (cursorData) => {

            // 使用 requestAnimationFrame 确保 DOM 已经渲染完毕
            requestAnimationFrame(() => {
                editor.update(() => {

                    setCursorPositions((prevPositions) => {
                        return ({
                            ...prevPositions,
                            [cursorData.userId]: cursorData,
                        })
                    });
                })
            })
        });

        return () => {

            unregister();
        };
    }, [editor, userId, userName, color]);

    // 计算光标位置并渲染光标
    return (
        <>
            {Object.entries(cursorPositions).map(([key, cursor]) => {

                return (
                    <CursorComponent key={key} cursor={cursor} editor={editor} />
                    // <div key={key}>test</div>
                )
            })}
        </>
    );
})

const CursorComponent = React.memo(({ cursor, editor }) => {

    const [position, setPosition] = useState({ left: 0, top: 0, visible: false });
    // const cursorRef = useRef(null); // 引入 ref 来管理光标 DOM 元素

    useEffect(() => {
        // const rootElement = editor.getRootElement();

        // if (rootElement && cursorRef.current) {
        //     console.log('created');

        //     rootElement.appendChild(cursorRef.current);
        // }
        // console.log(rootElement);

        const updateCursorPosition = () => {

            // 延迟执行以确保 DOM 更新完成
            editor.update(() => {
                editor.getEditorState().read(() => {
                    const rootNode = $getRoot();
                    const allNodes = [];

                    // 遍历根节点下的所有子节点
                    rootNode.getChildren().forEach((node) => {
                        console.log(node.getKey());

                        allNodes.push({ key: node.getKey(), type: node.getType() });

                        // 如果节点是一个包含子节点的复合节点，递归遍历其子节点
                        if (node.getChildren) {
                            node.getChildren().forEach((childNode) => {
                                allNodes.push({ key: childNode.getKey(), type: childNode.getType() });
                            });
                        }
                    });

                    // 打印所有节点信息
                });
                console.log(editor.getEditorState());

                let domElement = editor.getElementByKey(cursor.anchorKey);

                if (domElement) {
                    updatePosition(domElement);
                } else {
                    console.warn(`DOM element not found for anchorKey: ${cursor.anchorKey}`);
                    setPosition((prev) => ({ ...prev, visible: true }));
                }
            });

        };

        const updatePosition = (domElement) => {
            const range = document.createRange();

            // 如果是文本节点
            if (domElement.nodeType === Node.TEXT_NODE) {
                if (cursor.anchorOffset <= domElement.textContent.length) {
                    range.setStart(domElement, cursor.anchorOffset);
                    range.setEnd(domElement, cursor.anchorOffset);
                }
            } else if (domElement.childNodes.length > 0) {
                // 如果是包含子节点的元素节点
                const textNode = domElement.childNodes[0];
                if (textNode.nodeType === Node.TEXT_NODE && cursor.anchorOffset <= textNode.textContent.length) {
                    range.setStart(textNode, cursor.anchorOffset);
                    range.setEnd(textNode, cursor.anchorOffset);
                }
            }

            const rect = range.getBoundingClientRect();
            setPosition({
                left: rect.left,
                top: rect.top + window.scrollY,  // 考虑滚动位置
                visible: true,
            });
        };
        console.log('dada');

        // 初次渲染时更新光标位置
        updateCursorPosition();
        // 监听编辑器的更新，以在内容变化时重新计算光标位置
        // const unregister = editor.registerUpdateListener(() => {
        //     console.log('keyborad');

        //     updateCursorPosition();
        // });

        return () => {
            // unregister(); // 取消监听
        };
    }, [cursor.anchorKey, cursor.anchorOffset, editor]);

    // useEffect(() => {
    //     console.log('kaka');
    // const unregister = editor.registerUpdateListener(() => {
    //     console.log('keyborad');

    //     // updateCursorPosition();
    // });
    // 将光标元素添加到编辑器的根元素中，以避免光标被内容更新删除
    // const rootElement = editor.getRootElement();

    // if (rootElement && cursorRef.current) {
    //     rootElement.appendChild(cursorRef.current);
    // }

    // // 在组件卸载时，移除光标元素
    // return () => {

    //     if (cursorRef.current && cursorRef.current.parentNode) {
    //         cursorRef.current.parentNode.removeChild(cursorRef.current);
    //     }
    // };
    // }, [editor]);

    if (!position.visible) {

        return null; // 如果不可见，则不渲染
    }
    return (
        <div id={cursor.userId}
            style={{
                position: 'absolute',
                backgroundColor: cursor.color,
                left: `${position.left}px`,
                top: `${position.top}px`,
                height: '20px',
                width: '2px',
                zIndex: 1000, // 确保光标在其他内容之上
            }}
        >
            <span style={{ color: cursor.color, position: 'absolute', top: '-20px' }}>
                {cursor.userName}
            </span>
        </div>
    );

})

const EditorComponent = () => {
    console.log("EditorComponent");

    const [editor] = useLexicalComposerContext();
    const ydocRef = useRef(new Y.Doc());
    const stateVectorRef = useRef(Y.encodeStateVector(ydocRef.current)); // 初始化状态向量
    const [initialized, setInitialized] = useState(false);
    const isUpdatingFromYjs = useRef(false); // 标志位：是否由 Yjs 触发更新

    useEffect(() => {
        const ydoc = ydocRef.current;
        const yText = ydoc.getText('document');

        // 同步来自服务器的初始内容
        socket.on('sync-update', (update) => {

            Y.applyUpdate(ydoc, new Uint8Array(update));

            editor.update(() => {
                const textContent = yText.toString();

                if (textContent) {
                    try {
                        const content = JSON.parse(textContent);

                        isUpdatingFromYjs.current = true; // 设置标志位，避免循环
                        editor.setEditorState(editor.parseEditorState(content));
                        isUpdatingFromYjs.current = false;
                    } catch (error) {
                        console.error('Failed to parse JSON:', error);
                        editor.setEditorState(editor.parseEditorState(defaultEditorState));
                    }
                } else {
                    editor.setEditorState(editor.parseEditorState(defaultEditorState));
                }
            });
        });

        // 监听服务器的实时更新
        socket.on('broUpdate', (update) => {
            editor.update(() => {
                Y.applyUpdate(ydoc, new Uint8Array(update));

                isUpdatingFromYjs.current = true; // 设置标志位为true
                const textContent = yText.toString();
                console.log("Received updated content:", textContent); // 添加日志
                if (textContent) {
                    try {
                        const content = JSON.parse(textContent);
                        editor.setEditorState(editor.parseEditorState(content));
                    } catch (error) {
                        console.error('Failed to parse JSON during update:', error);
                    }
                }
                isUpdatingFromYjs.current = false; // 设置标志位为false
            });
        });

        // 注册编辑器的更新监听器，将内容同步到 Yjs 文档
        const unregister = editor.registerUpdateListener(({ editorState }) => {

            editor.update(() => {

                if (!isUpdatingFromYjs.current) { // 仅在非 Yjs 触发时进行处理
                    editorState.read(() => {
                        const editorContent = editorState.toJSON(); // 序列化编辑器内容
                        const newContent = JSON.stringify(editorContent);
                        console.log(newContent);

                        if (newContent !== yText.toString()) {
                            yText.delete(0, yText.length); // 清空 Yjs 文本
                            yText.insert(0, newContent);   // 插入新的内容

                            const update = Y.encodeStateAsUpdate(ydoc);
                            socket.emit('update', update)
                        }
                    });
                }
            });
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
    }, []);

    return (
        <>
            <ContentEditable className="editor" />
            <CollaborativeCursorPlugin userId={"userId"} userName={"userName"} color="blue" />
        </>
    );
};

const CollaborativeEditor = () => {
    console.log("CollaborativeEditor");

    // const [id, setId] = useState('');
    // const [name, setName] = useState('');
    // const changeName = (ele) => {
    //     setName(ele.target.value)
    // }
    // const changeId = (ele) => {
    //     setId(ele.target.value)
    // }
    return (
        <>
            {/* <input onChange={changeName} placeholder='change your name' />
            <input onChange={changeId} placeholder='change your id' /> */}
            <LexicalComposer initialConfig={initialConfig}>
                <div className="editor-container">
                    <RichTextPlugin
                        contentEditable={<EditorComponent />}
                        placeholder={<div className="editor-placeholder">Start typing...</div>}
                    />
                    <HistoryPlugin />
                </div>
            </LexicalComposer>
        </>

    );
};

export default CollaborativeEditor;
