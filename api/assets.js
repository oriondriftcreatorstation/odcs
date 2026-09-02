const { google } = require('google-auth-library');

module.exports = async (req, res) => {
    // Enable CORS for your frontend
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');

    // Get the service account JSON from environment variable
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

    // Authenticate with the service account
    const auth = new google.auth.GoogleAuth({
        credentials: creds,
        scopes: ['https://www.googleapis.com/auth/drive.readonly'],
    });

    const drive = google.drive({ version: 'v3', auth });

    // Folders
    const assetFolderIds = [
        '1YPHgDXLYrEz1-o52EQFKVBp5yHikOOca', // images
        '1LWXuSRzD0ZqNRIrFRYDASbjOIqYm9kqo', // sounds
        '1rMFkHSOaXA-uJwfBOqb9HUbiC4Z3ierq', // models
    ];
    const previewFolderId = '1p0Y83tqPEDloPIFndVJo2g3Kc_OOwQkg';

    async function fetchFilesFromFolders(folderIds) {
        if (!folderIds || folderIds.length === 0) return [];
        const query = folderIds.map(id => `'${id}'+in+parents`).join('+or+');
        const response = await drive.files.list({
            q: query,
            fields: 'files(id,name,mimeType,size,parents)',
            pageSize: 1000,
        });
        return response.data.files || [];
    }

    try {
        const [assets, previews] = await Promise.all([
            fetchFilesFromFolders(assetFolderIds),
            fetchFilesFromFolders([previewFolderId]),
        ]);

        // Filter out folders (just in case)
        const assetFiles = assets.filter(f => f.mimeType !== 'application/vnd.google-apps.folder');
        const previewFiles = previews.filter(f => f.mimeType.startsWith('image/'));

        // Cache on Vercel's CDN for 5 minutes
        res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate');

        res.status(200).json({ assets: assetFiles, previews: previewFiles });
    } catch (error) {
        console.error('Drive API error:', error);
        res.status(500).json({ error: error.message });
    }
};
