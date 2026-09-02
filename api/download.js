const { google } = require('googleapis');

module.exports = async (req, res) => {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');

    const fileId = req.query.id;
    const mode = req.query.mode || 'download';
    const filename = req.query.filename || 'download';

    if (!fileId) {
        return res.status(400).json({ error: 'Missing file ID' });
    }

    try {
        const credentials = process.env.GOOGLE_SERVICE_ACCOUNT;
        if (!credentials) {
            return res.status(500).json({ error: 'Service account credentials missing.' });
        }

        let creds;
        try {
            creds = JSON.parse(credentials);
        } catch (e) {
            return res.status(500).json({ error: 'Invalid service account JSON.' });
        }

        const auth = new google.auth.GoogleAuth({
            credentials: creds,
            scopes: ['https://www.googleapis.com/auth/drive.readonly'],
        });

        const drive = google.drive({ version: 'v3', auth });

        // Get file metadata for mime type and to verify access
        const fileMeta = await drive.files.get({
            fileId: fileId,
            fields: 'name,mimeType',
        });

        const actualFileName = fileMeta.data.name || filename;
        const mimeType = fileMeta.data.mimeType || 'application/octet-stream';

        // Stream the file from Drive
        const response = await drive.files.get(
            { fileId: fileId, alt: 'media' },
            { responseType: 'stream' }
        );

        // --- CRITICAL: Set Content-Disposition with proper encoding ---
        const encodedName = encodeURIComponent(actualFileName);
        const safeName = actualFileName.replace(/"/g, '\\"');
        
        if (mode === 'preview') {
            res.setHeader('Content-Disposition', `inline; filename="${safeName}"; filename*=UTF-8''${encodedName}`);
        } else {
            // Force download with correct filename
            res.setHeader('Content-Disposition', `attachment; filename="${safeName}"; filename*=UTF-8''${encodedName}`);
        }
        
        // Set content type
        res.setHeader('Content-Type', mimeType);
        // Disable caching for downloads
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');

        // Pipe the file stream
        response.data.pipe(res);

    } catch (error) {
        console.error('Download error:', error);
        res.status(500).json({ error: error.message });
    }
};
