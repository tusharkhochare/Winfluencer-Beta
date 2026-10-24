
import { useEffect, useState } from "react";
import "./Community.css";

const CHANNELS_KEY = "winfluencer_channels";
const PROFILES_KEY = "winfluencer_creator_profiles";
const INSPIRATIONS_KEY = "winfluencer_inspirations";
const CACHE_KEY = "winfluencer_community_cache";

function readStorage(key, fallback) {
  try {
    return JSON.parse(
      localStorage.getItem(key) || JSON.stringify(fallback)
    );
  } catch {
    return fallback;
  }
}

function Community() {
  const [channels] = useState(() =>
    readStorage(CHANNELS_KEY, [])
  );

  const [profiles] = useState(() =>
    readStorage(PROFILES_KEY, {})
  );

  const [selectedChannelId, setSelectedChannelId] = useState(
    () => readStorage(CHANNELS_KEY, [])[0]?.id || ""
  );

  const [inspirations, setInspirations] = useState(() =>
    readStorage(INSPIRATIONS_KEY, {})
  );

  const [cache, setCache] = useState(() =>
    readStorage(CACHE_KEY, {})
  );

  const [inspirationUrl, setInspirationUrl] = useState("");
  const [adding, setAdding] = useState(false);
  const [loadingVideos, setLoadingVideos] = useState(false);
  const [error, setError] = useState("");
  const [playerVideo, setPlayerVideo] = useState(null);

  const channel =
    channels.find((item) => item.id === selectedChannelId) ||
    channels[0] ||
    null;

  const profile = channel ? profiles[channel.id] : null;

  const channelInspirations = channel
    ? inspirations[channel.id] || []
    : [];

  const channelCache = channel
    ? cache[channel.id] || {}
    : {};

  useEffect(() => {
    localStorage.setItem(
      INSPIRATIONS_KEY,
      JSON.stringify(inspirations)
    );
  }, [inspirations]);

  useEffect(() => {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  }, [cache]);

  async function addInspiration(event) {
    event.preventDefault();

    if (!channel || !inspirationUrl.trim()) return;

    if (channelInspirations.length >= 5) {
      setError("You can add up to five inspiration channels.");
      return;
    }

    setAdding(true);
    setError("");

    try {
      const response = await fetch(
        "http://localhost:5000/api/community/inspirations",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            url: inspirationUrl.trim(),
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Could not add this channel.");
      }

      if (channelInspirations.some((item) => item.id === data.channel.id)) {
        throw new Error("This inspiration is already added.");
      }

      setInspirations((previous) => ({
        ...previous,
        [channel.id]: [
          ...(previous[channel.id] || []),
          data.channel,
        ],
      }));

      setInspirationUrl("");
    } catch (err) {
      setError(err.message);
    } finally {
      setAdding(false);
    }
  }

  function removeInspiration(inspirationId) {
    if (!channel) return;

    setInspirations((previous) => ({
      ...previous,
      [channel.id]: (previous[channel.id] || []).filter(
        (item) => item.id !== inspirationId
      ),
    }));

    setCache((previous) => {
      const updated = { ...previous };
      const creatorCache = { ...(updated[channel.id] || {}) };
      delete creatorCache[inspirationId];
      updated[channel.id] = creatorCache;
      return updated;
    });
  }

  async function loadVideos({ refresh = false } = {}) {
    if (!channel || !profile) {
      setError("Add a channel and analyze it on Dashboard first.");
      return;
    }

    if (!refresh && channelCache.relatedVideos?.length) {
      return;
    }

    setLoadingVideos(true);
    setError("");

    try {
      const response = await fetch(
        "http://localhost:5000/api/community/related-videos",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            channel,
            profile,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Could not load related videos.");
      }

      setCache((previous) => ({
        ...previous,
        [channel.id]: {
          ...(previous[channel.id] || {}),
          relatedVideos: data.videos || [],
          relatedFetchedAt: new Date().toISOString(),
        },
      }));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingVideos(false);
    }
  }

  async function loadInspirationVideos(inspiration) {
    const saved = channelCache[inspiration.id];

    if (saved?.videos?.length) return;

    setError("");
    setLoadingVideos(true);

    try {
      const response = await fetch(
        "http://localhost:5000/api/community/inspiration-videos",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            channelId: inspiration.id,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Could not load inspiration videos.");
      }

      setCache((previous) => ({
        ...previous,
        [channel.id]: {
          ...(previous[channel.id] || {}),
          [inspiration.id]: {
            videos: data.videos || [],
            fetchedAt: new Date().toISOString(),
          },
        },
      }));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingVideos(false);
    }
  }

  if (!channel) {
    return (
      <main className="community-page">
        <h1>Community</h1>
        <p>Add a YouTube channel on Dashboard to get started.</p>
      </main>
    );
  }

  return (
    <main className="community-page">
      <header className="community-header">
        <div>
          <p className="community-eyebrow">CREATOR FEED</p>
          <h1>Community</h1>
          <p>Get inspired by creators and videos in your niche.</p>
        </div>

        {channels.length > 1 && (
          <select
            value={channel.id}
            onChange={(event) => {
              setSelectedChannelId(event.target.value);
              setPlayerVideo(null);
              setError("");
            }}
            aria-label="Select your channel"
          >
            {channels.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        )}
      </header>

      {!profile && (
        <section className="community-notice">
          Analyze this channel with AI on Dashboard to enable related videos.
        </section>
      )}

      {error && (
        <div className="community-error" role="alert">
          {error}
        </div>
      )}

      <section className="community-section">
        <div className="community-section-heading">
          <div>
            <h2>Inspirations</h2>
            <p>Follow up to five channels for video inspiration.</p>
          </div>
          <span className="community-count">
            {channelInspirations.length}/5
          </span>
        </div>

        <form className="community-add-form" onSubmit={addInspiration}>
          <input
            type="url"
            value={inspirationUrl}
            onChange={(event) => setInspirationUrl(event.target.value)}
            placeholder="Paste a YouTube channel URL"
            aria-label="YouTube channel URL"
            required
          />
          <button
            type="submit"
            disabled={adding || channelInspirations.length >= 5}
          >
            {adding ? "Adding..." : "Add"}
          </button>
        </form>

        {channelInspirations.length === 0 ? (
          <div className="community-empty">
            <h3>Add your first inspiration</h3>
            <p>
              Paste the URL of a YouTube channel whose content inspires you.
            </p>
          </div>
        ) : (
          <div className="inspiration-list">
            {channelInspirations.map((inspiration) => {
              const videos =
                channelCache[inspiration.id]?.videos || [];

              return (
                <article
                  className="inspiration-card"
                  key={inspiration.id}
                >
                  <div className="inspiration-card-heading">
                    <div className="inspiration-channel">
                      {inspiration.thumbnail ? (
                        <img
                          src={inspiration.thumbnail}
                          alt=""
                        />
                      ) : (
                        <div className="inspiration-avatar">
                          {inspiration.name?.charAt(0) || "Y"}
                        </div>
                      )}

                      <h3>{inspiration.name}</h3>
                    </div>

                    <button
                      className="community-remove"
                      onClick={() => removeInspiration(inspiration.id)}
                      type="button"
                    >
                      Remove
                    </button>
                  </div>

                  <button
                    className="community-text-button"
                    onClick={() => loadInspirationVideos(inspiration)}
                    disabled={loadingVideos}
                    type="button"
                  >
                    {videos.length
                      ? "Latest videos loaded"
                      : "Load latest videos"}
                  </button>

                  {videos.length > 0 && (
                    <div className="community-video-grid">
                      {videos.map((video) => (
                        <button
                          className="community-video"
                          key={video.id}
                          onClick={() => setPlayerVideo(video)}
                          type="button"
                        >
                          <img
                            src={video.thumbnail}
                            alt=""
                            loading="lazy"
                          />
                        </button>
                      ))}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="community-section">
        <div className="community-section-heading">
          <div>
            <h2>Top 5 Related Videos</h2>
            <p>Videos related to your channel's content.</p>
          </div>

          <button
            className="community-text-button"
            onClick={() => loadVideos({ refresh: true })}
            disabled={loadingVideos || !profile}
            type="button"
          >
            {loadingVideos ? "Loading..." : "Refresh"}
          </button>
        </div>

        {!channelCache.relatedVideos?.length ? (
          <div className="community-empty">
            <p>
              {profile
                ? "Load your five related videos when you're ready."
                : "Analyze your channel on Dashboard first."}
            </p>

            {profile && (
              <button
                onClick={() => loadVideos()}
                disabled={loadingVideos}
                type="button"
              >
                {loadingVideos ? "Loading..." : "Load videos"}
              </button>
            )}
          </div>
        ) : (
          <div className="community-video-grid">
            {channelCache.relatedVideos.slice(0, 5).map((video) => (
              <button
                className="community-video"
                key={video.id}
                onClick={() => setPlayerVideo(video)}
                type="button"
              >
                <img
                  src={video.thumbnail}
                  alt=""
                  loading="lazy"
                />
              </button>
            ))}
          </div>
        )}
      </section>

      {playerVideo && (
        <div
          className="community-player-backdrop"
          onClick={() => setPlayerVideo(null)}
          role="presentation"
        >
          <section
            className="community-player"
            role="dialog"
            aria-modal="true"
            aria-label="YouTube video player"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              className="community-player-close"
              onClick={() => setPlayerVideo(null)}
              aria-label="Close video"
              type="button"
            >
              ×
            </button>

            <div className="community-player-frame">
              <iframe
                src={`https://www.youtube-nocookie.com/embed/${encodeURIComponent(playerVideo.id)}?autoplay=1`}
                title="YouTube video player"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
              />
            </div>
          </section>
        </div>
      )}
    </main>
  );
}

export default Community;
