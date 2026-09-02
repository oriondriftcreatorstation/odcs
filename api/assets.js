const { google } = require('google-auth-library');

module.exports = async (req, res) => {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');

    try {
        // 1. Check environment variable
        const credentials = process.env.GOOGLE_SERVICE_ACCOUNT;
        if (!credentials) {
            console.error('❌ GOOGLE_SERVICE_ACCOUNT environment variable is not set');
            return res.status(500).json({ 
                error: 'Service account credentials missing.',
                details: 'GOOGLE_SERVICE_ACCOUNT env var not found'
            });
        }

        // 2. Parse the JSON
        let creds;
        try {
            creds = JSON.parse(credentials);
        } catch (e) {
            console.error('❌ Failed to parse GOOGLE_SERVICE_ACCOUNT JSON:', e.message);
            return res.status(500).json({ 
                error: 'Invalid service account JSON.',
                details: e.message
            });
        }

        // 3. Verify the JSON has required fields
        if (!creds.client_email || !creds.private_key) {
            console.error('❌ JSON missing client_email or private_key');
            return res.status(500).json({ 
                error: 'Service account JSON is missing required fields.',
                details: 'Missing client_email or private_key'
            });
        }

        console.log('✅ Service account loaded:', creds.client_email);

        // 4. Authenticate
        const auth = new google.auth.GoogleAuth({
            credentials: creds,
            scopes: ['https://www.googleapis.com/auth/drive.readonly'],
        });

        const drive = google.drive({ version: 'v3', auth });

        // 5. Folders
        const assetFolderIds = [
            '1YPHgDXLYrEz1-o52EQFKVBp5yHikOOca', // images
            '1LWXuSRzD0ZqNRIrFRYDASbjOIqYm9kqo', // sounds
            '1rMFkHSOaXA-uJwfBOqb9HUbiC4Z3ierq', // models
        ];
        const previewFolderId = '1p0Y83tqPEDloPIFndVJo2g3Kc_OOwQkg';

        async function fetchFilesFromFolders(folderIds) {
            if (!folderIds || folderIds.length === 0) return [];
            const query = folderIds.map(id => `'${id}'+in+parents`).join('+or+');
            console.log('📡 Fetching from Drive with query:', query);
            const response = await drive.files.list({
                q: query,
                fields: 'files(id,name,mimeType,size,parents)',
                pageSize: 1000,
            });
            return response.data.files || [];
        }

        // 6. Fetch files
        console.log('🔍 Fetching assets from Drive...');
        const [assets, previews] = await Promise.all([
            fetchFilesFromFolders(assetFolderIds),
            fetchFilesFromFolders([previewFolderId]),
        ]);

        // Filter out folders
        const assetFiles = assets.filter(f => f.mimeType !== 'application/vnd.google-apps.folder');
        const previewFiles = previews.filter(f => f.mimeType.startsWith('image/'));

        console.log(`✅ Fetched ${assetFiles.length} assets and ${previewFiles.length} previews`);

        // Cache for 5 minutes
        res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate');

        res.status(200).json({ assets: assetFiles, previews: previewFiles });
    } catch (error) {
        console.error('❌ Unhandled error:', error.message);
        console.error('Stack:', error.stack);
        res.status(500).json({ 
            error: 'Internal server error',
            message: error.message,
            stack: error.stack 
        });
    }
};
