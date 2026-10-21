# Focus Monitor

A lightweight Chrome extension that helps you protect focus time and understand
how much time you spend on websites. It includes a 25-minute focus timer and a
daily list of your five most-used websites.

## Install

1. Open `chrome://extensions` in Chrome and turn on **Developer mode**.
2. Select **Load unpacked** and choose this repository's folder.
3. Pin **Focus Monitor** from the extensions menu to access the popup.

## Privacy

Website activity is recorded as time spent on hostnames and stored locally using
the browser's extension storage. It is not sent to a server. The extension only
tracks web pages in the focused browser window while you are active;
browser-internal pages are ignored. Daily activity older than 30 days is
discarded.
