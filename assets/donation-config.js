/* ==========================================================================
   DONATION CONFIG  —  EDIT THIS FILE ONLY
   --------------------------------------------------------------------------
   The owner supplied a real Maya QR card image, so the QR is no longer
   generated from a link. The image lives at:

       assets/maya-qr.jpg

   To change the QR later, replace that file (keep the same name) or point
   QR_IMAGE at a different path. Nothing else in the site needs to change.

   The account details below are transcribed from the supplied image:
     name    J. H.            <- initials only, by the owner's request
     number  +63 *** *** 8049   <- MASKED in the image, so it is shown as-is
                                    and is NOT offered as a copy target.

   The account handle has been removed from the site at the owner's request,
   and is covered on the QR card image itself. Do not add it back.

   TODO (OWNER): if you want the full number shown as copyable text, paste it
   into MAYA_NUMBER below. Leave it empty to keep showing only the name.
   Never put an API key or secret in this file — everything here is printed
   on the page.
   ========================================================================== */
window.LEARN_PHP_DONATION = {
  /* The QR card image, relative to the site root. */
  QR_IMAGE: 'assets/maya-qr.jpg',

  /* Shown as the label above the QR. */
  LABEL: 'Maya',

  /* Initials only, by the owner's request. Shown as copyable text next to
     the QR. The full name is deliberately not stored anywhere in this site. */
  ACCOUNT_NAME: 'J. H.',

  /* Removed at the owner's request — leave empty. The widget only renders a
     handle row when this is non-empty. */
  ACCOUNT_HANDLE: '',

  /* Masked in the supplied image — displayed as-is, not copyable. */
  MASKED_NUMBER: '+63 *** *** 8049',

  /* TODO: paste the full Maya number here to make it copyable. */
  MAYA_NUMBER: '',

  /* Optional: a Maya payment link, if you have one. Leave empty to hide. */
  MAYA_LINK: ''
};
