'use client';
import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { loadInsights, getInsightsSummary, getTopicsForChannel, scoreUpload } from '@/lib/channelInsights';
import styles from './page.module.css';

function ScoreBar({ score }) {
  const color = score >= 70 ? '#22c55e' : score >= 50 ? '#f59e0b' : '#ef4444';
  return (
    <div className={styles.scoreBar}>
      <div className={styles.scoreTrack}>
        <div className={styles.scoreFill} style={{ width: `${score}%`, background: color }} />
      </div>
      <span className={styles.scoreNum} style={{ color }}>{score}</span>
    </div>
  );
}

function TopicCard({ item, onCopy }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard?.writeText(item.topic).catch(() => {});
    onCopy?.(item.topic);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className={styles.topicCard}>
      <div className={styles.topicText}>{item.topic}</div>
      <div className={styles.topicTags}>{item.tags?.map(t => <span key={t} className={styles.tag}>{t}</span>)}</div>
      <button className={styles.copyBtn} onClick={handleCopy}>{copied ? '✅ Copied' : '📋 Use this'}</button>
    </div>
  );
}

function UploadRow({ entry }) {
  const score = scoreUpload(entry);
  const date = entry.uploadedAt ? new Date(entry.uploadedAt).toLocaleDateString() : '—';
  return (
    <div className={styles.uploadRow}>
      <div className={styles.uploadMeta}>
        <span className={styles.uploadTitle}>{entry.title || 'Untitled'}</span>
        <span className={styles.uploadDate}>{date}</span>
        {entry.genre && <span className={styles.uploadGenre}>{entry.genre}</span>}
      </div>
      <ScoreBar score={score} />
      {entry.ytVideoUrl && (
        <a href={entry.ytVideoUrl} target="_blank" rel="noopener noreferrer" className={styles.ytLink}>▶ YouTube</a>
      )}
    </div>
  );
}

export default function InsightsPage() {
  const { channelId } = useParams();
  const [summary, setSummary] = useState(null);
  const [uploads, setUploads] = useState([]);
  const [topics, setTopics] = useState([]);
  const [tab, setTab] = useState('overview');

  useEffect(() => {
    const s = getInsightsSummary(channelId);
    const { uploads: u } = loadInsights(channelId);
    const t = getTopicsForChannel(channelId);
    setSummary(s);
    setUploads(u);
    setTopics(t);
  }, [channelId]);

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <Link href={`/video-creator/${channelId}`} className={styles.backLink}>← Channel</Link>
        <h1 className={styles.title}>📊 Channel Insights</h1>
        <p className={styles.subtitle}>What&apos;s working · history · topic ideas</p>
      </div>

      <div className={styles.tabs}>
        {['overview', 'history', 'topics'].map(t => (
          <button key={t} className={`${styles.tab} ${tab === t ? styles.tabActive : ''}`} onClick={() => setTab(t)}>
            {t === 'overview' ? '📈 Overview' : t === 'history' ? '📋 History' : '💡 Topic Ideas'}
          </button>
        ))}
      </div>

      {tab === 'overview' && summary && (
        <div className={styles.overview}>
          <div className={styles.statsRow}>
            <div className={styles.statCard}>
              <span className={styles.statNum}>{summary.totalUploads}</span>
              <span className={styles.statLabel}>Total Videos</span>
            </div>
            <div className={styles.statCard}>
              <span className={styles.statNum}>{summary.avgScore || '—'}</span>
              <span className={styles.statLabel}>Avg Score</span>
            </div>
          </div>

          {summary.topGenres.length > 0 && (
            <div className={styles.section}>
              <h2 className={styles.sectionTitle}>Top Genres</h2>
              <div className={styles.genreList}>
                {summary.topGenres.map(({ genre, count }) => (
                  <div key={genre} className={styles.genreRow}>
                    <span className={styles.genreName}>{genre}</span>
                    <span className={styles.genreCount}>{count} videos</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {summary.topTopics.length > 0 && (
            <div className={styles.section}>
              <h2 className={styles.sectionTitle}>Best Performing Topics</h2>
              {summary.topTopics.map(({ topic, avgScore }) => (
                <div key={topic} className={styles.topTopicRow}>
                  <span className={styles.topTopicText}>{topic}</span>
                  <ScoreBar score={avgScore} />
                </div>
              ))}
            </div>
          )}

          {summary.totalUploads === 0 && (
            <div className={styles.emptyState}>
              No uploads yet — generate and upload your first video to see insights here.
            </div>
          )}
        </div>
      )}

      {tab === 'history' && (
        <div className={styles.history}>
          {uploads.length === 0 ? (
            <div className={styles.emptyState}>No uploads recorded yet.</div>
          ) : (
            uploads.map((entry, i) => <UploadRow key={i} entry={entry} />)
          )}
        </div>
      )}

      {tab === 'topics' && (
        <div className={styles.topicsTab}>
          <p className={styles.topicsHint}>
            These are proven viral formats — everyday frustrations, food, family, money, tech rage.
            Click &quot;Use this&quot; to copy a topic into your script generator.
          </p>
          <div className={styles.topicsGrid}>
            {topics.map((item, i) => (
              <TopicCard key={i} item={item} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
