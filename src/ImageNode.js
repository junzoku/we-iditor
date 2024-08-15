import { DecoratorNode } from 'lexical';

export class ImageNode extends DecoratorNode {
    static getType() {
        return 'image';
    }

    static clone(node) {
        return new ImageNode(node.src, node.altText, node.key);
    }

    constructor(src, altText, key) {
        super(key);
        this.src = src;
        this.altText = altText;
    }

    createDOM() {
        const img = document.createElement('img');
        img.src = this.src;
        img.alt = this.altText;
        img.style.maxWidth = '100%';
        return img;
    }

    updateDOM(prevNode) {
        return prevNode.src !== this.src || prevNode.altText !== this.altText;
    }

    static importJSON(serializedNode) {
        const { src, altText } = serializedNode;
        return new ImageNode(src, altText);
    }

    exportJSON() {
        return {
            type: 'image',
            src: this.src,
            altText: this.altText,
            version: 1,
        };
    }
}

export function $createImageNode(src, altText) {
    return new ImageNode(src, altText);
}

export function $isImageNode(node) {
    return node instanceof ImageNode;
}
