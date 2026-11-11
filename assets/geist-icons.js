/* QuickCart icon set: Geist-style 24px stroke icons (1.6px, round caps).
   Replaces emoji used as UI icons with inline SVG (currentColor), now and for anything added later.
   Also fills <i data-ico="name"></i> placeholders. */
(function () {
  'use strict';
  var P = {
    'check': 'M20 6 9 17l-5-5',
    'x': 'M18 6 6 18M6 6l12 12',
    'alert': 'M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4M12 17h.01',
    'arrow-right': 'M5 12h14M12 5l7 7-7 7',
    'arrow-left': 'M19 12H5M12 19l-7-7 7-7',
    'arrow-up': 'M12 19V5M5 12l7-7 7 7',
    'arrow-down': 'M12 5v14M19 12l-7 7-7-7',
    'external': 'M7 17 17 7M7 7h10v10',
    'flame': 'M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.07-2.14-.22-4.05 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.15.43-2.29 1-3a2.5 2.5 0 0 0 2.5 2.5z',
    'package': 'M16.5 9.4 7.5 4.21M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16zM3.27 6.96 12 12.01l8.73-5.05M12 22.08V12',
    'cart': 'M9 21a1 1 0 1 0 0-2 1 1 0 0 0 0 2zM20 21a1 1 0 1 0 0-2 1 1 0 0 0 0 2zM1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6',
    'download': 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3',
    'upload': 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12',
    'save': 'M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2zM17 21v-8H7v8M7 3v5h8',
    'phone': 'M7 2h10a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zM12 18h.01',
    'card': 'M3 5h18a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2zM1 10h22',
    'zap': 'M13 2 3 14h9l-1 8 10-12h-9l1-8z',
    'clipboard': 'M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2M9 2h6a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1z',
    'laptop': 'M20 16V7a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v9m16 0H4m16 0 1.28 2.55a1 1 0 0 1-.9 1.45H3.62a1 1 0 0 1-.9-1.45L4 16',
    'camera': 'M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3zM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
    'store': 'M3 9l1.5-5h15L21 9M3 9v11h18V9M3 9a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0M9 20v-5h6v5',
    'globe': 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z',
    'star': 'm12 2 3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z',
    'gamepad': 'M6 12h4M8 10v4M15 13h.01M18 11h.01M17.32 5H6.68a4 4 0 0 0-3.98 3.59C2.6 9.42 2 14.46 2 16a3 3 0 0 0 3 3c1 0 1.5-.5 2-1l1.41-1.41A2 2 0 0 1 9.83 16h4.34a2 2 0 0 1 1.42.59L17 18c.5.5 1 1 2 1a3 3 0 0 0 3-3c0-1.55-.6-6.58-.68-7.26A4 4 0 0 0 17.32 5z',
    'plug': 'M12 22v-5M9 8V2M15 8V2M18 8v5a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4V8z',
    'trophy': 'M6 9H4.5a2.5 2.5 0 0 1 0-5H6M18 9h1.5a2.5 2.5 0 0 0 0-5H18M4 22h16M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22M18 2H6v7a6 6 0 0 0 12 0V2z',
    'dollar': 'M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6',
    'rocket': 'M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09zM12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2zM9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5',
    'trash': 'M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6',
    'sparkles': 'M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3zM19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15z',
    'bell': 'M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 0 0 3.4 0',
    'bot': 'M12 8V4H8M4 8h16a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2zM2 14h2M20 14h2M15 13v2M9 13v2',
    'lock': 'M5 11h14a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2zM7 11V7a5 5 0 0 1 10 0v4',
    'unlock': 'M5 11h14a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2zM7 11V7a5 5 0 0 1 9.9-1',
    'plus': 'M12 5v14M5 12h14',
    'headphones': 'M3 14v-3a9 9 0 0 1 18 0v3M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z',
    'bank': 'M3 22h18M6 18v-7M10 18v-7M14 18v-7M18 18v-7M12 2 3 7h18l-9-5z',
    'search': 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.3-4.3',
    'palette': 'M12 22a1 1 0 0 1 0-20 10 9 0 0 1 10 9 5 5 0 0 1-5 5h-2.25a1.75 1.75 0 0 0-1.4 2.8l.3.4a1.75 1.75 0 0 1-1.4 2.8zM13.5 6.5h.01M17.5 10.5h.01M6.5 12.5h.01M8.5 7.5h.01',
    'mail': 'M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM22 7l-10 7L2 7',
    'message': 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z',
    'printer': 'M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2M6 14h12v8H6z',
    'heart': 'M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78z',
    'receipt': 'M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1zM16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8M12 17.5v-11',
    'megaphone': 'M3 11l18-5v12L3 14v-3zM11.6 16.8a3 3 0 1 1-5.8-1.6',
    'eye': 'M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
    'bag': 'M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4zM3 6h18M16 10a4 4 0 0 1-8 0',
    'link': 'M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71',
    'tag': 'M12.59 2.59A2 2 0 0 0 11.17 2H4a2 2 0 0 0-2 2v7.17a2 2 0 0 0 .59 1.42l8.7 8.7a2.43 2.43 0 0 0 3.42 0l6.58-6.58a2.43 2.43 0 0 0 0-3.42zM7.5 7.5h.01',
    'image': 'M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM9 11a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM21 15l-3.09-3.09a2 2 0 0 0-2.82 0L6 21',
    'undo': 'M3 7v6h6M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13',
    'redo': 'M21 7v6h-6M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3L21 13',
    'menu': 'M4 12h16M4 6h16M4 18h16',
    'chart': 'M3 3v18h18M7 16V9M12 16V5M17 16v-4',
    'trend': 'M23 6l-9.5 9.5-5-5L1 18M17 6h6v6',
    'settings': 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z',
    'home': 'M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM9 22V12h6v10',
    'bulb': 'M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5M9 18h6M10 22h4',
    'pin': 'M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0zM12 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
    'folder': 'M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2z',
    'gift': 'M20 12v10H4V12M2 7h20v5H2zM12 22V7M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7zM12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z',
    'scissors': 'M6 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM6 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM20 4 8.12 15.88M14.47 14.48 20 20M8.12 8.12 12 12',
    'scale': 'M12 3v18M3 7h18M5 7l-3 8a4 4 0 0 0 6 0L5 7zM19 7l-3 8a4 4 0 0 0 6 0l-3-8z',
    'refresh': 'M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8M21 3v5h-5M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16M8 16H3v5',
    'factory': 'M2 20a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8l-7 5V8l-7 5V4a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2zM17 18h1M12 18h1M7 18h1',
    'layers': 'm12 2 10 5-10 5L2 7zM2 17l10 5 10-5M2 12l10 5 10-5',
    'edit': 'M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z',
    'briefcase': 'M4 7h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2zM16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16',
    'gem': 'M6 3h12l4 6-10 13L2 9zM11 3 8 9l4 13 4-13-3-6M2 9h20',
    'monitor': 'M4 3h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM8 21h8M12 17v4',
    'target': 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 18a6 6 0 1 0 0-12 6 6 0 0 0 0 12zM12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
    'help': 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3M12 17h.01',
    'hash': 'M4 9h16M4 15h16M10 3 8 21M16 3l-2 18',
    'users': 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75',
    'truck': 'M1 3h13v13H1zM14 8h4l3 3v5h-7zM5.5 21a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM18.5 21a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
    'shield': 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
    'book': 'M4 19.5A2.5 2.5 0 0 1 6.5 17H20M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z',
    'clock': 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 6v6l4 2',
    'archive': 'M21 8v13H3V8M1 3h22v5H1zM10 12h4',
    'cursor': 'M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z',
    'play': 'M5 3l14 9-14 9V3z',
    'dot': ''
  };
  var E = {
    '✅': 'check', '✔': 'check', '✓': 'check', '☑': 'check', '❌': 'x', '✕': 'x', '✘': 'x', '✗': 'x', '✖': 'x', '⚠': 'alert', '⚠️': 'alert',
    '🔥': 'flame', '📦': 'package', '🛒': 'cart', '⬇': 'download', '⬇️': 'download', '📥': 'download', '⬆': 'upload', '⬆️': 'upload', '💾': 'save',
    '📱': 'phone', '📲': 'phone', '💳': 'card', '⚡': 'zap', '📋': 'clipboard', '💻': 'laptop', '📷': 'camera', '🏪': 'store', '🏬': 'store', '🌐': 'globe',
    '⭐': 'star', '🎮': 'gamepad', '🔌': 'plug', '🏆': 'trophy', '💰': 'dollar', '💵': 'dollar', '🚀': 'rocket', '🗑': 'trash', '🗑️': 'trash',
    '🎉': 'sparkles', '✨': 'sparkles', '💥': 'sparkles', '🔔': 'bell', '🤖': 'bot', '🔒': 'lock', '🔐': 'lock', '🔓': 'unlock', '➕': 'plus',
    '🎧': 'headphones', '🏦': 'bank', '🏭': 'factory', '🔍': 'search', '🎨': 'palette', '📧': 'mail', '📩': 'mail', '📨': 'mail', '💬': 'message',
    '🖨': 'printer', '🖨️': 'printer', '❤️': 'heart', '❤': 'heart', '♡': 'heart', '🧾': 'receipt', '📣': 'megaphone', '👁': 'eye', '👁️': 'eye',
    '🛍': 'bag', '🛍️': 'bag', '🤝': 'users', '👥': 'users', '🔗': 'link', '🏷': 'tag', '🏷️': 'tag', '🖼': 'image', '↶': 'undo', '↷': 'redo', '☰': 'menu',
    '📒': 'book', '📚': 'book', '📊': 'chart', '📈': 'trend', '🎟': 'tag', '🎟️': 'tag', '⚙': 'settings', '⚙️': 'settings', '✏': 'edit', '✏️': 'edit',
    '🏠': 'home', '💡': 'bulb', '📌': 'pin', '📍': 'pin', '🗂': 'folder', '📁': 'folder', '🎁': 'gift', '✂': 'scissors', '✂️': 'scissors', '⚖': 'scale',
    '⚖️': 'scale', '🔄': 'refresh', '🧱': 'layers', '📝': 'edit', '💼': 'briefcase', '💎': 'gem', '🖥': 'monitor', '🖥️': 'monitor', '🎯': 'target',
    '❓': 'help', '🔢': 'hash', '🚚': 'truck', '🛡': 'shield', '🛡️': 'shield', '⌚': 'clock', '👟': 'bag', '🖱': 'cursor', '🖱️': 'cursor', '▶': 'play',
    '🛠': 'settings', '🔧': 'settings', '🥇': 'trophy', '🥈': 'trophy', '🥉': 'trophy', '🌴': 'store', '👔': 'bag',
    '🟢': 'dot:#2ea44f', '🟠': 'dot:#f5a623', '🔵': 'dot:#ff5a1f', '🔷': 'dot:#ff5a1f', '🟦': 'dot:#ff5a1f', '🟩': 'dot:#2ea44f', '🔴': 'dot:#e5484d', '🟡': 'dot:#f5a623'
  };
  // build the matcher: longest keys first
  var keys = Object.keys(E).sort(function (a, b) { return b.length - a.length; });
  var RX = new RegExp('(' + keys.map(function (k) { return k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }).join('|') + ')\\uFE0F?', 'g');
  var SKIP = { SCRIPT: 1, STYLE: 1, TEXTAREA: 1, INPUT: 1, OPTION: 1, SELECT: 1, TITLE: 1, NOSCRIPT: 1, SVG: 1, CODE: 1, PRE: 1 };

  function svg(name) {
    var color = null;
    if (name.indexOf('dot:') === 0) { color = name.slice(4); name = 'dot'; }
    var s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('class', 'qci' + (name === 'dot' ? ' fill' : '')); s.setAttribute('aria-hidden', 'true'); s.setAttribute('data-n', name);
    if (name === 'dot') {
      var c = document.createElementNS('http://www.w3.org/2000/svg', 'circle'); c.setAttribute('cx', 12); c.setAttribute('cy', 12); c.setAttribute('r', 5);
      if (color) c.setAttribute('fill', color); s.appendChild(c); return s;
    }
    var path = document.createElementNS('http://www.w3.org/2000/svg', 'path'); path.setAttribute('d', P[name] || P.dot); s.appendChild(path);
    return s;
  }
  function inSkip(n) {
    for (var e = n.parentNode; e && e.nodeType === 1; e = e.parentNode) {
      if (SKIP[e.nodeName.toUpperCase()] || e.isContentEditable || (e.hasAttribute && e.hasAttribute('data-noicons'))) return true;
    }
    return false;
  }
  function fixText(node) {
    var t = node.nodeValue; if (!t || !RX.test(t)) { RX.lastIndex = 0; return; } RX.lastIndex = 0;
    if (inSkip(node)) return;
    var frag = document.createDocumentFragment(), last = 0, m;
    while ((m = RX.exec(t))) {
      if (m.index > last) frag.appendChild(document.createTextNode(t.slice(last, m.index)));
      var key = m[1], nm = E[key] || E[key.replace(/\uFE0F/g, '')];
      frag.appendChild(nm ? svg(nm) : document.createTextNode(m[0]));
      last = m.index + m[0].length;
    }
    RX.lastIndex = 0;
    if (last < t.length) frag.appendChild(document.createTextNode(t.slice(last)));
    node.parentNode.replaceChild(frag, node);
  }
  function scan(root) {
    root = root || document.body; if (!root) return;
    if (root.nodeType === 3) { fixText(root); return; }
    var w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, { acceptNode: function (n) { return n.nodeValue && n.nodeValue.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT; } });
    var list = [], n; while ((n = w.nextNode())) list.push(n);
    list.forEach(fixText);
    if (root.querySelectorAll) root.querySelectorAll('[data-ico]').forEach(function (el) {
      if (el.firstChild) return; var nm = el.getAttribute('data-ico'); if (P[nm]) el.appendChild(svg(nm));
    });
  }
  var pending = new Set(), raf = 0;
  function flush() { raf = 0; var items = Array.from(pending); pending.clear(); items.forEach(function (n) { if (n.isConnected !== false) scan(n); }); }
  function start() {
    scan(document.body);
    new MutationObserver(function (ms) {
      ms.forEach(function (m) {
        if (m.type === 'characterData') pending.add(m.target);
        else m.addedNodes.forEach(function (n) { if (n.nodeType === 1 || n.nodeType === 3) pending.add(n); });
      });
      if (!raf) raf = requestAnimationFrame(flush);
    }).observe(document.body, { childList: true, subtree: true, characterData: true });
  }
  window.QCIcons = { scan: scan, svg: svg, paths: P };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
