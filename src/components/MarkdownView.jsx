import { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { db } from '../db';

const ImageRenderer = ({ src, alt, ...props }) => {
    const [imageSrc, setImageSrc] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let objectUrl = null;

        const loadImage = async () => {
            if (src.startsWith('local-image://')) {
                const imageId = src.replace('local-image://', '');
                try {
                    const imageRecord = await db.images.get(imageId);
                    if (imageRecord && imageRecord.blob) {
                        objectUrl = URL.createObjectURL(imageRecord.blob);
                        setImageSrc(objectUrl);
                    } else {
                        setImageSrc(null); // Not found
                    }
                } catch (e) {
                    console.error("Failed to load local image:", e);
                }
            } else {
                setImageSrc(src);
            }
            setLoading(false);
        };

        loadImage();

        return () => {
            if (objectUrl) URL.revokeObjectURL(objectUrl);
        };
    }, [src]);

    if (loading) return <span className="animate-pulse bg-gray-700 w-full h-48 block rounded"></span>;
    if (!imageSrc) return <span className="text-red-500 text-xs">[Image Failed: {alt}]</span>;

    return (
        <img
            src={imageSrc}
            alt={alt}
            className="max-w-full rounded-lg my-4 border border-[var(--border-color)] shadow-lg"
            {...props}
        />
    );
};

const MarkdownView = ({ content }) => {
    return (
        <div className="prose prose-invert max-w-none prose-p:text-[var(--text-color)] prose-headings:text-[var(--text-color)] prose-a:text-blue-400">
            <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                    img: ImageRenderer,
                    code({ node, inline, className, children, ...props }) {
                        return !inline ? (
                            <pre className="bg-[var(--bg-color)] p-4 rounded-lg overflow-x-auto border border-[var(--border-color)]">
                                <code {...props} className={className}>
                                    {children}
                                </code>
                            </pre>
                        ) : (
                            <code {...props} className="bg-[var(--surface-color)] px-1 py-0.5 rounded text-sm font-mono">
                                {children}
                            </code>
                        );
                    }
                }}
                urlTransform={(url) => {
                    if (url.startsWith('local-image:')) return url;
                    return url;
                }}
            >
                {content}
            </ReactMarkdown>
        </div>
    );
};

export default MarkdownView;
