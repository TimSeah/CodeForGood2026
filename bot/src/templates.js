const templates = {
  parent_confirm: ['ap_parent_confirm', 6],
  parent_cancelled: ['ap_parent_cancelled', 4],
  parent_call_centre: ['ap_parent_call_centre', 2],
  therapist_cover: ['ap_therapist_cover', 4],
  therapist_confirmed: ['ap_therapist_confirmed', 2],
  therapist_stand_down: ['ap_therapist_stand_down', 3],
};

export function templateMessage(notification, mediaId) {
  const config = templates[notification.purpose];
  if (!config || !Array.isArray(notification.variables) || notification.variables.length !== config[1] ||
      notification.variables.some((value) => typeof value !== 'string' || !value.trim())) {
    throw new Error(`Missing approved template variables for ${notification.purpose}`);
  }
  if (notification.attachment && (!mediaId || notification.purpose !== 'therapist_cover')) {
    throw new Error('Document template is only available for therapist cover notices');
  }
  const phone = recipientPhone(notification.toPhone);
  const name = mediaId ? 'ap_therapist_cover_document' : config[0];
  const parameters = notification.variables.map((value) => ({ type: 'text', text: value }));
  return {
    to: phone,
    type: 'template',
    template: {
      name, language: { code: 'en_US' },
      components: [
        ...(mediaId ? [{ type: 'header', parameters: [{ type: 'document', document: { id: mediaId, filename: 'session-handover.pdf' } }] }] : []),
        { type: 'body', parameters },
      ],
    },
  };
}

export function recipientPhone(phone) {
  const digits = phone?.replace(/[ +()-]/g, '');
  if (!digits || !/^\d{8,15}$/.test(digits)) throw new Error('Recipient phone number is missing or invalid');
  return digits;
}
