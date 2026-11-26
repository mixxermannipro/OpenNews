import type { NewsArticle } from '../types/news';
import { getArticleMedia, getReaderAttachments } from '../lib/articleMedia';
import { ArticleImage } from './ArticleImage';
import { MediaPlayer } from './MediaPlayer';

export function ArticleMedia({ article, heroImage, background }: { article: NewsArticle; heroImage?: string; background: boolean }) {
  const media = article.media ?? getArticleMedia(article);
  const attachments = getReaderAttachments(media, heroImage, [article.imageUrl]);
  if (!attachments.length) return null;

  return (
    <div className="mt-5 space-y-4">
      {attachments.map(attachment => attachment.type === 'image' ? (
        <ArticleImage
          key={attachment.url}
          src={attachment.url}
          alt=""
          sourceShortCode={article.sourceShortCode}
          sourceColor={article.sourceColor}
          hideOnError
          className="aspect-video w-full overflow-hidden rounded-2xl"
        />
      ) : (
        <div key={attachment.url} className="settings-group overflow-hidden">
          <div className={attachment.type === 'audio' ? 'p-4' : attachment.portrait ? 'mx-auto aspect-[9/16] max-w-[19rem]' : 'aspect-video'}>
            {attachment.type === 'audio' && <p className="mb-2 text-xs font-semibold">Audio-Beitrag</p>}
            <MediaPlayer media={{ ...attachment, type: attachment.type }} title={article.title} background={background} />
          </div>
        </div>
      ))}
    </div>
  );
}
