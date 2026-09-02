const { google } = require('googleapis');

module.exports = async (req, res) => {
    // Enable CORS for your frontend
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');

    const fileId = req.query.id;
    const mode = req.query.mode || 'download'; // 'preview' or 'download'

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

        // Get file metadata to know name and mime type
        const fileMeta = await drive.files.get({
            fileId: fileId,
            fields: 'name,mimeType',
        });

        const fileName = fileMeta.data.name;
        const mimeType = fileMeta.data.mimeType || 'application/octet-stream';

        // Stream the file from Drive
        const response = await drive.files.get(
            { fileId: fileId, alt: 'media' },
            { responseType: 'stream' }
        );

        // Set appropriate headers
        res.setHeader('Content-Type', mimeType);
        
        if (mode === 'preview') {
            // For preview: try to display inline
            res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(fileName)}"`);
        } else {
            // For download: force download
            res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}"`);
        }

        // Pipe the file stream to the response
        response.data.pipe(res);

    } catch (error) {
        console.error('Download error:', error);
        res.status(500).json({ error: error.message });
    }
};
