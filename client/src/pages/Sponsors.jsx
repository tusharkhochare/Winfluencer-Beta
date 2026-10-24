
import { useState } from "react";
import "./Sponsors.css";

const CHANNELS_KEY = "winfluencer_channels";
const PROFILES_KEY = "winfluencer_creator_profiles";

function readStorage(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback));
  } catch {
    return fallback;
  }
}

function Sponsors() {
  const channels = readStorage(CHANNELS_KEY, []);
  const profiles = readStorage(PROFILES_KEY, {});

  const [selectedChannelId, setSelectedChannelId] = useState("");
  const [selectedSponsor, setSelectedSponsor] = useState(null);
  const [creatorName, setCreatorName] = useState("");
  const [email, setEmail] = useState("");
  const [discoveredSponsors, setDiscoveredSponsors] = useState([]);
    const [searchingSponsors, setSearchingSponsors] = useState(false);
    const [sponsorError, setSponsorError] = useState("");

  const channel =
    channels.find((item) => item.id === selectedChannelId) ||
    channels[0] ||
    null;

  const profile = channel ? profiles[channel.id] : null;

  const sponsors = (profile?.sponsorCategories || []).map((item) => ({
    name: item.category,
    reason: item.reason,
  }));

  
async function generateMail(sponsor) {
  if (!channel || !profile) {
    setSponsorError("Analyze a channel on Dashboard first.");
    return;
  }

  setSelectedSponsor(sponsor);
  setEmail("Generating email...");

  try {
    const response = await fetch(
      "http://localhost:5000/api/ai/generate-sponsor-email",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          channel,
          profile,
          sponsor: {
            name: sponsor.name,
            reason: sponsor.reason,
          },
          creatorName: creatorName.trim() || "Content Creator",
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data.error || "Email generation failed."
      );
    }

    setEmail(data.email);
  } catch (error) {
    console.error("Sponsor email error:", error);
    setEmail(`Could not generate email: ${error.message}`);
  }
}


  async function copyMail() {
    try {
      await navigator.clipboard.writeText(email);
      alert("Email copied!");
    } catch {
      alert("Copy failed. Please select and copy the email manually.");
    }
  }



async function findSponsors() {
  if (!channel || !profile) {
    setSponsorError("Analyze a channel on Dashboard first.");
    return;
  }

  setSearchingSponsors(true);
  setSponsorError("");
  setDiscoveredSponsors([]);

  const categories = (profile.sponsorCategories || []).map((item) => ({
    name: item.category,
    reason: item.reason,
  }));

  setDiscoveredSponsors(categories);
  setSearchingSponsors(false);
}



  return (
    <main className="sponsors-page">
      <header className="sponsors-header">
        <p className="sponsors-eyebrow">BRAND MATCHES</p>
        <h1>Sponsors Finder</h1>
        <p>Discover relevant sponsors and prepare personalized outreach.</p>
      </header>

      {channels.length > 1 && (
        <select
          className="sponsors-select"
          value={channel?.id || ""}
          onChange={(event) => {
            setSelectedChannelId(event.target.value);
            setSelectedSponsor(null);
            setEmail("");
          }}
        >
          {channels.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
      )}

      {!channel ? (
        <p>Add a YouTube channel from Dashboard first.</p>
      ) : !profile ? (
        <p>
          Analyze this channel with AI on Dashboard before finding sponsors.
        </p>
      ) : (
        <>
          <section className="sponsors-creator">
            <span>CREATOR NICHE</span>
            <h2>{profile.primaryNiche}</h2>
            <p>{channel.name}</p>
          </section>

          
<section className="sponsors-list">
  <div className="sponsor-results-heading">
    <h2>Suggested Companies</h2>

    <button
      className="sponsor-mail-btn"
      onClick={findSponsors}
      disabled={searchingSponsors}
    >
      {searchingSponsors ? "Searching..." : "Find Sponsors"}
    </button>
  </div>

  {sponsorError && (
    <p className="sponsor-error">{sponsorError}</p>
  )}

  {!searchingSponsors && discoveredSponsors.length === 0 && (
    <p>
      Select Find Sponsors to discover real companies relevant to
      your creator profile.
    </p>
  )}

  {discoveredSponsors.map((sponsor, index) => (
    <article
      className="sponsor-row"
      key={`${sponsor.name}-${index}`}
    >
      <div className="sponsor-info">
        <h3>{sponsor.name}</h3>
        <p>{sponsor.reason}</p>

        {sponsor.website && (
          <p>
            <a href={sponsor.website} target="_blank" rel="noreferrer">
              Official website
            </a>
          </p>
        )}

        {sponsor.sourceUrl && (
          <p>
            <a href={sponsor.sourceUrl} target="_blank" rel="noreferrer">
              Research source
            </a>
          </p>
        )}

        {sponsor.evidence && (
          <p>{sponsor.evidence}</p>
        )}
      </div>

      <button
        className="sponsor-mail-btn"
        onClick={() => generateMail(sponsor)}
      >
        Mail
      </button>
    </article>
  ))}
</section>


          {selectedSponsor && (
            <section className="sponsor-email-panel">
              <h2>{selectedSponsor.name} — Email</h2>

              <label htmlFor="creator-name">Your name (optional)</label>
              <input
                id="creator-name"
                value={creatorName}
                onChange={(event) => setCreatorName(event.target.value)}
                placeholder="Your name"
              />

              <label htmlFor="sponsor-email">Email draft</label>
              <textarea
                id="sponsor-email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                rows={14}
              />

              <button
                className="sponsor-mail-btn"
                onClick={copyMail}
                disabled={!email || email === "Generating email..."}
              >
                Copy Mail
              </button>
            </section>
          )}
        </>
      )}
    </main>
  );
}

export default Sponsors;
