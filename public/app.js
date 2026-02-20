const generateBtn = document.getElementById('generateBtn');
const latestLink = document.getElementById('latestLink');
const eventsList = document.getElementById('events');

function renderEvent(event) {
  const item = document.createElement('li');
  item.className = 'event-item';
  item.innerHTML = `
    <strong>${new Date(event.timestamp).toLocaleString()}</strong><br>
    Link: ${event.linkId}<br>
    Browser: ${event.userAgent}<br>
    Platform: ${event.platform}<br>
    Language: ${event.language}<br>
    Screen: ${event.screen}
  `;
  eventsList.prepend(item);
}

generateBtn.addEventListener('click', async () => {
  latestLink.textContent = 'Generating link...';
  generateBtn.disabled = true;

  try {
    const response = await fetch('/api/links', { method: 'POST' });
    if (!response.ok) {
      throw new Error('Failed to create link');
    }

    const data = await response.json();
    const shareUrl = data.fullUrl || `${window.location.origin}${data.slug}`;
    latestLink.innerHTML = `Generated link: <a href="${shareUrl}" target="_blank">${shareUrl}</a>`;
  } catch (error) {
    latestLink.textContent = 'Link generation failed. Please try again.';
  } finally {
    generateBtn.disabled = false;
  }
});

async function loadEvents() {
  const response = await fetch('/api/events');
  const events = await response.json();
  eventsList.innerHTML = '';
  events.forEach(renderEvent);
}

const stream = new EventSource('/api/stream');
stream.onmessage = (message) => {
  const event = JSON.parse(message.data);
  renderEvent(event);
};

loadEvents();
