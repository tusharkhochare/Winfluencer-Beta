
function ChannelWindow({ channel, onRemove }) {
  return (
    <div className="channel-window">
      <div className="channel-window-header">
        <div className="channel-identity">
          <img
            src={channel.thumbnail}
            alt={channel.name}
            className="channel-window-avatar"
          />

          <div>
            <p className="channel-platform">YOUTUBE</p>
            <h3>{channel.name}</h3>
          </div>
        </div>

        <button
          className="remove-channel-btn"
          onClick={() => onRemove(channel.id)}
          title="Remove channel"
          aria-label={`Remove ${channel.name}`}
        >
          ×
        </button>
      </div>

      <div className="channel-window-stats">
        <div>
          <span>Subscribers</span>
          <strong>
            {Number(channel.subscribers ?? 0).toLocaleString()}
          </strong>
        </div>

        <div>
          <span>Total Views</span>
          <strong>
            {Number(channel.views ?? 0).toLocaleString()}
          </strong>
        </div>

        <div>
          <span>Videos</span>
          <strong>
            {Number(channel.videos ?? 0).toLocaleString()}
          </strong>
        </div>
      </div>

      {channel.sevenDayPerformance && (
        <div className="mini-performance">
          <p className="section-label">CONTENT PERFORMANCE</p>
          <h4>Last 7 Days</h4>

          <div className="mini-performance-stats">
            <div>
              <span>Videos</span>
              <strong>
                {channel.sevenDayPerformance.videoCount}
              </strong>
            </div>

            <div>
              <span>Combined Views</span>
              <strong>
                {Number(
                  channel.sevenDayPerformance.combinedViews
                ).toLocaleString()}
              </strong>
            </div>

            <div>
              <span>Average Views</span>
              <strong>
                {Number(
                  channel.sevenDayPerformance.averageViews
                ).toLocaleString()}
              </strong>
            </div>
          </div>
        </div>
      )}

      {channel.recentVideos?.length > 0 && (
        <div className="mini-videos">
          <h4>Recent Content</h4>

          {channel.recentVideos.slice(0, 3).map((video) => (
            <div className="mini-video" key={video.id}>
              <img src={video.thumbnail} alt="" />

              <div className="mini-video-info">
                <p>{video.title}</p>
                <span>
                  {Number(video.views).toLocaleString()} views
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default ChannelWindow;
