
import { useEffect, useState } from "react";
import ChannelWindow from "../components/ChannelWindow";

const STORAGE_KEY = "winfluencer_channels";

function Dashboard() {
  const [url, setUrl] = useState("");
  const [channelPreview, setChannelPreview] = useState(null);
  const [channels, setChannels] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

const [lastRefreshed, setLastRefreshed] = useState(
  localStorage.getItem("winfluencer_last_refreshed") || ""
);

const [refreshMessage, setRefreshMessage] = useState("");

const [analyzingChannelId, setAnalyzingChannelId] = useState(null);
const [aiError, setAiError] = useState("");
const [creatorProfiles, setCreatorProfiles] = useState(() => {
  try {
    return JSON.parse(
      localStorage.getItem("winfluencer_creator_profiles") || "{}"
    );
  } catch {
    return {};
  }
});


  // Load saved channels when Dashboard opens

useEffect(() => {
  let cancelled = false;

  const loadAndRefreshChannels = async () => {
    let savedChannels = [];

    try {
      const saved = localStorage.getItem(STORAGE_KEY);

      if (saved) {
        const parsed = JSON.parse(saved);

        if (Array.isArray(parsed)) {
          savedChannels = parsed;
        }
      } else {
        // Migrate data from the previous single-channel version
        const oldChannel = localStorage.getItem(
          "winfluencer_channel"
        );

        if (oldChannel) {
          const parsedOld = JSON.parse(oldChannel);

          if (parsedOld?.id) {
            savedChannels = [parsedOld];
          }

          localStorage.removeItem("winfluencer_channel");
        }
      }

      if (cancelled) return;

      // Display cached cards immediately
      setChannels(savedChannels);

      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(savedChannels)
      );

      if (savedChannels.length === 0) return;

      setRefreshing(true);
      setRefreshMessage("Updating channel statistics...");

      let successfulRefreshes = 0;

      const refreshedChannels = await Promise.all(
        savedChannels.map(async (channel) => {
          try {
            const response = await fetch(
              "http://localhost:5000/api/youtube/analyze",
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  url: `https://youtube.com/channel/${channel.id}`,
                }),
              }
            );

            if (!response.ok) {
              throw new Error("Refresh request failed");
            }

            const freshData = await response.json();

            if (freshData.id !== channel.id) {
              throw new Error("Channel ID did not match");
            }

            successfulRefreshes += 1;

            return {
              ...freshData,
              lastRefreshed: new Date().toISOString(),
            };
          } catch (err) {
            console.error(
              `Could not refresh ${channel.name}:`,
              err
            );

            // Retain the last saved snapshot
            return channel;
          }
        })
      );

      if (cancelled) return;

      setChannels(refreshedChannels);

      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(refreshedChannels)
      );

      if (successfulRefreshes > 0) {
        const timestamp = new Date().toISOString();

        localStorage.setItem(
          "winfluencer_last_refreshed",
          timestamp
        );

        setLastRefreshed(timestamp);

        setRefreshMessage(
          successfulRefreshes === savedChannels.length
            ? "All channels updated successfully."
            : `${successfulRefreshes} of ${savedChannels.length} channels updated. Some are showing saved data.`
        );
      } else {
        setRefreshMessage(
          "Could not refresh channels. Showing saved statistics."
        );
      }
    } catch (err) {
      console.error("Could not load channels:", err);

      if (!cancelled) {
        setError("Could not load saved channels.");
      }
    } finally {
      if (!cancelled) {
        setRefreshing(false);
      }
    }
  };

  loadAndRefreshChannels();

  return () => {
    cancelled = true;
  };
}, []);


  // Analyze a YouTube channel using the existing backend
  const analyzeChannel = async () => {
    if (!url.trim()) {
      setError("Please enter a YouTube channel URL.");
      return;
    }

    setLoading(true);
    setError("");
    setChannelPreview(null);

    try {
      const response = await fetch(
        "http://localhost:5000/api/youtube/analyze",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ url: url.trim() }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Failed to analyze channel"
        );
      }

      setChannelPreview(data);
    } catch (err) {
      setError(err.message || "Failed to analyze channel.");
    } finally {
      setLoading(false);
    }
  };


const analyzeCreator = async (channel) => {
  setAnalyzingChannelId(channel.id);
  setAiError("");

  try {
    const response = await fetch(
      "http://localhost:5000/api/ai/analyze-creator",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ channel }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data.message || data.error || "AI analysis failed."
      );
    }

    const updatedProfiles = {
      ...creatorProfiles,
      [channel.id]: data.profile,
    };

    localStorage.setItem(
      "winfluencer_creator_profiles",
      JSON.stringify(updatedProfiles)
    );

    setCreatorProfiles(updatedProfiles);
  } catch (err) {
    console.error("Creator AI analysis failed:", err);
    setAiError(
      err.message || "Could not analyze this creator."
    );
  } finally {
    setAnalyzingChannelId(null);
  }
};


  // Add a channel to the persistent Dashboard collection
  const addChannel = () => {
    if (!channelPreview?.id) return;

    const alreadyAdded = channels.some(
      (item) => item.id === channelPreview.id
    );

    if (alreadyAdded) {
      setError("This channel is already on your Dashboard.");
      return;
    }

    const updatedChannels = [...channels, channelPreview];

    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(updatedChannels)
      );

      setChannels(updatedChannels);
      setChannelPreview(null);
      setUrl("");
      setError("");
      setShowAddForm(false);
    } catch (err) {
      console.error("Could not save channel:", err);
      setError("Could not save this channel in browser storage.");
    }
  };

  // Remove only the selected channel
  const removeChannel = (channelId) => {
    const updatedChannels = channels.filter(
      (item) => item.id !== channelId
    );

    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(updatedChannels)
      );

      setChannels(updatedChannels);
      setError("");
    } catch (err) {
      console.error("Could not remove channel:", err);
      setError("Could not update saved channels.");
    }
  };

  return (
    <main className="main">
      <div className="dashboard-header">
        <div>
          <p className="eyebrow">CREATOR WORKSPACE</p>
          <h1>
            My <span>Channels</span>
          </h1>
          <p className="subtitle">
            Manage your YouTube channels, stats, and AI profiles in one place.
          </p>
        </div>

        <div className="dashboard-header-meta">
          {refreshing && <span className="live-chip">Updating stats…</span>}
          {!refreshing && refreshMessage && (
            <span className="muted-chip">{refreshMessage}</span>
          )}
          {lastRefreshed && (
            <span className="muted-chip">
              Last updated {new Date(lastRefreshed).toLocaleString()}
            </span>
          )}
          <button
            className="analyze-btn"
            onClick={() => {
              setShowAddForm((visible) => !visible);
              setChannelPreview(null);
              setError("");
            }}
          >
            {showAddForm ? "Cancel" : "+ Add Channel"}
          </button>
        </div>
      </div>

      {error && <p className="error">{error}</p>}

      {showAddForm && (
        <section className="input-section">
          <label htmlFor="channel-url">
            YouTube Channel URL
          </label>

          <div className="input-row">
            <input
              id="channel-url"
              type="text"
              placeholder="https://youtube.com/@YourChannel"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !loading) {
                  analyzeChannel();
                }
              }}
            />

            <button
              className="analyze-btn"
              onClick={analyzeChannel}
              disabled={loading}
            >
              {loading ? "Analyzing..." : "Analyze"}
            </button>
          </div>

          {channelPreview && (
            <div className="channel-preview">
              <div className="channel-top">
                <img
                  src={channelPreview.thumbnail}
                  alt={channelPreview.name}
                  className="channel-image"
                />

                <div className="channel-info">
                  <p className="verified">CHANNEL PREVIEW</p>
                  <h2>{channelPreview.name}</h2>
                  <p className="channel-id">
                    {channelPreview.id}
                  </p>
                </div>
              </div>

              <div className="stats">
                <div className="stat">
                  <span>Subscribers</span>
                  <strong>
                    {Number(
                      channelPreview.subscribers ?? 0
                    ).toLocaleString()}
                  </strong>
                </div>

                <div className="stat">
                  <span>Total Views</span>
                  <strong>
                    {Number(
                      channelPreview.views ?? 0
                    ).toLocaleString()}
                  </strong>
                </div>

                <div className="stat">
                  <span>Videos</span>
                  <strong>
                    {Number(
                      channelPreview.videos ?? 0
                    ).toLocaleString()}
                  </strong>
                </div>
              </div>

              <button
                className="add-btn"
                onClick={addChannel}
                disabled={channels.some(
                  (item) => item.id === channelPreview.id
                )}
              >
                {channels.some(
                  (item) => item.id === channelPreview.id
                )
                  ? "Already Added"
                  : "+ Add to Dashboard"}
              </button>
            </div>
          )}
        </section>
      )}
      {aiError && <p className="error">{aiError}</p>}
      <div className="channel-grid-heading">
        <h2>Connected Channels</h2>
        <span>{channels.length} added</span>
      </div>

      {channels.length === 0 ? (
        <div className="empty-channels">
          <h3>No channels added yet</h3>
          <p>
            Add a public YouTube channel to create your first
            Dashboard window.
          </p>

          <button
            className="analyze-btn"
            onClick={() => setShowAddForm(true)}
          >
            + Add Your First Channel
          </button>
        </div>
      ) : (
        <div className="dashboard-channel-grid">
          {channels.map((item) => (
  <div className="dashboard-channel-item" key={item.id}>
    <ChannelWindow
      channel={item}
      onRemove={removeChannel}
    />

    <button
      className="analyze-btn"
      onClick={() => analyzeCreator(item)}
      disabled={analyzingChannelId !== null}
    >
      {analyzingChannelId === item.id
        ? "Analyzing with Gemini..."
        : creatorProfiles[item.id]
          ? "Re-analyze Creator"
          : "Analyze Creator with AI"}
    </button>

    {creatorProfiles[item.id] && (
      <div className="creator-ai-profile">
        <p className="eyebrow">AI CREATOR PROFILE</p>

        <h3>{creatorProfiles[item.id].primaryNiche}</h3>

        <p>
          <strong>Sub-niches:</strong>{" "}
          {(creatorProfiles[item.id].subNiches || []).join(", ")}
        </p>

        <h4>Content Themes</h4>
        <ul>
          {(creatorProfiles[item.id].contentThemes || []).map(
            (theme, index) => (
              <li key={index}>{theme}</li>
            )
          )}
        </ul>

        <h4>Recommended Sponsor Categories</h4>
        {(creatorProfiles[item.id].sponsorCategories || []).map(
          (sponsor, index) => (
            <div className="creator-sponsor-category" key={index}>
              <strong>{sponsor.category}</strong>
              <p>{sponsor.reason}</p>
            </div>
          )
        )}

        <h4>Competitor Search Keywords</h4>
        <div className="creator-keywords">
          {(creatorProfiles[item.id].competitorSearchKeywords || []).map(
            (keyword, index) => (
              <span key={index}>{keyword}</span>
            )
          )}
        </div>

        <p className="creator-confidence">
          Analysis confidence:{" "}
          {creatorProfiles[item.id].confidence || "Not specified"}
        </p>
      </div>
    )}
  </div>
))}

          <button
            className="add-channel-window"
            onClick={() => {
              setShowAddForm(true);
              setChannelPreview(null);
              setError("");
            }}
          >
            <span>+</span>
            <strong>Add Channel</strong>
            <p>Connect another YouTube channel</p>
          </button>
        </div>
      )}
    </main>
  );
}

export default Dashboard;
