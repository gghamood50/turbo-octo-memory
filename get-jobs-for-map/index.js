const functions = require('firebase-functions');
const admin = require('firebase-admin');
const axios = require('axios');
const cors = require('cors')({ origin: true });

admin.initializeApp();

const db = admin.firestore();
const GEOCODING_API_KEY = 'AIzaSyA7KZvWbdEBx8UAUcQrRGEBtGKFgo99C9s';

exports.getJobsForMap = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
        try {
            const date = req.query.date;

            if (!date) {
                return res.status(400).send('A "date" query parameter is required.');
            }

            const jobsQuery = db.collection('jobs')
                .where('status', 'in', ['Awaiting completion', 'Scheduled', 'Completed'])
                .where('scheduledDate', '==', date);
            
            const snapshot = await jobsQuery.get();

            if (snapshot.empty) {
                return res.status(200).json([]);
            }

            const jobs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            const geocodingPromises = jobs.map(async (job) => {
                if (!job.address) {
                    return { ...job, location: null };
                }
                try {
                    const response = await axios.get('https://maps.googleapis.com/maps/api/geocode/json', {
                        params: {
                            address: job.address,
                            key: GEOCODING_API_KEY
                        }
                    });

                    if (response.data.results && response.data.results.length > 0) {
                        const location = response.data.results[0].geometry.location;
                        return { ...job, location }; // location will be { lat, lng }
                    } else {
                        return { ...job, location: null };
                    }
                } catch (error) {
                    console.error(`Geocoding failed for address "${job.address}":`, error.message);
                    return { ...job, location: null }; // Return job without location on geocoding error
                }
            });

            const jobsWithLocations = await Promise.all(geocodingPromises);

            res.status(200).json(jobsWithLocations);

        } catch (error) {
            console.error('Error fetching jobs for map:', error);
            res.status(500).send('Internal Server Error');
        }
    });
});
