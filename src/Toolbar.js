import React from 'react';
import { $getSelection, $isRangeSelection } from 'lexical';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $createImageNode } from './ImageNode';

const Toolbar = () => {
    const [editor] = useLexicalComposerContext();

    const insertImage = (url) => {
        editor.update(() => {
            const selection = $getSelection();
            if ($isRangeSelection(selection)) {
                const imageNode = $createImageNode(url, 'Image');
                selection.insertNodes([imageNode]);
            }
        });
    };

    return (
        <div className="toolbar">
            <button onClick={() => insertImage('https://via.placeholder.com/150')}>Insert Image</button>
        </div>
    );
};

export default Toolbar;
