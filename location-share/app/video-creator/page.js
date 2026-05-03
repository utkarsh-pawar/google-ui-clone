'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { CHANNEL_DEFINITIONS } from '@/lib/financeTopics';
import { isYouTubeConnected, disconnectYouTube } from '@/lib/youtubeUtils';
import styles from './page.module.css';

const CUSTOM_CHANNELS_KEY = 'vc_custom_channels';

function loadCustomChannels() {
  try { return JSON.parse(localStorage.getItem(CUSTOM_CHANNELS_KEY) || '[]'); }
  catch { return []; }
}

function saveCustomChannels(channels) {
  try { localStorage.setItem(CUSTOM_CHANNELS_KEY, JSON.stringify(channels)); }
  catch {}
}

export default function VideoCreatorLanding() {
  const [ytStatus, setYtStatus] = useState({});
  const [customChannels, setCustomChannels] = useState([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [newGenre, setNewGenre] = useState('motivation');
  const [newIcon, setNewIcon] = useState('🎥');

  useEffect(() => {
    const status = {};
    [...CHANNEL_DEFINITIONS, ...loadCustomChannels()].forEach(ch => {
      status[ch.id] = isYouTubeConnected(ch.id);
    });
    setYtStatus(status);
    setCustomChannels(loadCustomChannels());
  }, []);

  const allChannels = [...CHANNEL_DEFINITIONS, ...customChannels];

  const handleAddChannel = () => {
    if (!newName.trim()) return;
    const id = `custom_${Date.now()}`;
    const channel = {
      id,
      name: newName.trim(),
      icon: newIcon,
      color: '#6366f1',
      genres: [newGenre],
      desc: `Custom channel — ${newGenre} content`,
      custom: true,
    };
    const updated = [...customChannels, channel];
    saveCustomChannels(updated);
    setCustomChannels(updated);
    setYtStatus(s => ({ ...s, [id]: false }));
    setShowAddModal(false);
    setNewName('');
    setNewGenre('motivation');
    setNewIcon('🎥');
  };

  const handleDeleteChannel = (id) => {
    const updated = customChannels.filter(c => c.id !== id);
    saveCustomChannels(updated);
    setCustomChannels(updated);
  };

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <Link href="/" className={styles.back}>← Back</Link>
        <div className={styles.headerCenter}>
          <span className={styles.logo}>🎬</span>
          <div>
            <div className={styles.title}>Video Creator</div>
            <div className={styles.subtitle}>Select a channel to start creating</div>
          </div>
        </div>
        <div className={styles.headerRight} />
      </header>

      <div className={styles.body}>
        <div className={styles.sectionHeader}>
          <div className={styles.sectionLabel}>Your Channels</div>
          <button className={styles.addBtn} onClick={() => setShowAddModal(true)}>
            + Add Channel
          </button>
        </div>

        <div className={styles.channelGrid}>
          {allChannels.map(ch => (
            <ChannelCard
              key={ch.id}
              channel={ch}
              connected={ytStatus[ch.id] || false}
              onDelete={ch.custom ? () => handleDeleteChannel(ch.id) : null}
              onDisconnect={() => {
                disconnectYouTube(ch.id);
                setYtStatus(s => ({ ...s, [ch.id]: false }));
              }}
            />
          ))}
        </div>
      </div>

      {showAddModal && (
        <div className={styles.modalOverlay} onClick={() => setShowAddModal(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalTitle}>Add New Channel</div>

            <div className={styles.modalField}>
              <label className={styles.modalLabel}>Channel Name</label>
              <input
                className={styles.modalInput}
                placeholder="e.g. My Tech Channel"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                maxLength={40}
                autoFocus
              />
            </div>

            <div className={styles.modalField}>
              <label className={styles.modalLabel}>Icon (emoji)</label>
              <input
                className={styles.modalInput}
                value={newIcon}
                onChange={e => setNewIcon(e.target.value)}
                maxLength={4}
              />
            </div>

            <div className={styles.modalField}>
              <label className={styles.modalLabel}>Primary Genre</label>
              <div className={styles.genreGrid}>
                {[
                  { id: 'motivation', label: '🔥 Motivation' },
                  { id: 'finance', label: '💰 Finance' },
                  { id: 'stories', label: '📖 Stories' },
                  { id: 'sports', label: '🏆 Sports' },
                  { id: 'religious', label: '🙏 Spiritual' },
                ].map(g => (
                  <button
                    key={g.id}
                    className={`${styles.genreBtn} ${newGenre === g.id ? styles.genreBtnActive : ''}`}
                    onClick={() => setNewGenre(g.id)}
                  >
                    {g.label}
                  </button>
                ))}
              </div>
            </div>

            <div className={styles.modalActions}>
              <button className={styles.modalCancel} onClick={() => setShowAddModal(false)}>Cancel</button>
              <button className={styles.modalSave} onClick={handleAddChannel} disabled={!newName.trim()}>
                Create Channel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ChannelCard({ channel, connected, onDelete, onDisconnect }) {
  return (
    <div className={styles.channelCard} style={{ '--ch-color': channel.color }}>
      <div className={styles.cardTop}>
        <div className={styles.cardIconWrap} style={{ background: `${channel.color}22`, borderColor: `${channel.color}44` }}>
          <span className={styles.cardIcon}>{channel.icon}</span>
        </div>
        <div className={styles.cardMeta}>
          <div className={styles.cardName}>{channel.name}</div>
          <div className={styles.cardDesc}>{channel.desc}</div>
        </div>
        {onDelete && (
          <button className={styles.deleteBtn} onClick={onDelete} title="Remove channel">×</button>
        )}
      </div>

      <div className={styles.cardStatus}>
        {connected ? (
          <div className={styles.ytConnectedRow}>
            <span className={styles.ytBadge + ' ' + styles.ytConnected}>✅ YouTube Connected</span>
            <button className={styles.disconnectBtn} onClick={onDisconnect}>Disconnect</button>
          </div>
        ) : (
          <a href={`/api/youtube/auth?channelId=${channel.id}`} className={styles.ytConnectBtn}>
            🔗 Connect YouTube
          </a>
        )}
      </div>

      <div className={styles.cardGenres}>
        {channel.genres.map(g => (
          <span key={g} className={styles.genreTag}>{g}</span>
        ))}
      </div>

      <div className={styles.cardActions}>
        <Link href={`/video-creator/${channel.id}`} className={styles.createBtn}>
          🎬 Create Video
        </Link>
        <Link href={`/video-creator/${channel.id}/scheduler`} className={styles.schedulerBtn}>
          📅 Scheduler
        </Link>
      </div>
    </div>
  );
}
