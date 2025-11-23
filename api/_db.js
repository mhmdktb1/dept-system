/**
 * MongoDB Connection Helper for Vercel Serverless Functions
 * 
 * This module provides a reusable database connection that is cached globally
 * to avoid reconnecting on every serverless function invocation.
 */

import { MongoClient } from 'mongodb';

/**
 * Global connection cache
 * 
 * Vercel serverless functions can be reused across multiple requests in the same
 * container instance. By caching the connection globally, we avoid the overhead
 * of establishing a new MongoDB connection on every function invocation.
 * 
 * The cache structure:
 * - cached.conn: The database instance (null if not connected)
 * - cached.promise: Promise of the connection (to prevent multiple simultaneous connections)
 */
let cached = global._mongo;

if (!cached) {
    cached = global._mongo = { 
        conn: null, 
        promise: null 
    };
}

/**
 * Get MongoDB database instance
 * 
 * This function returns a cached database connection if available, or creates
 * a new connection if one doesn't exist. The connection is reused across
 * multiple serverless function invocations within the same container.
 * 
 * @returns {Promise<Db>} MongoDB database instance for "chocair_fresh"
 * 
 * @example
 * const db = await getDb();
 * const customers = await db.collection('customers').find({}).toArray();
 */
export async function getDb() {
    // Return cached connection if available
    if (cached.conn) {
        return cached.conn;
    }

    // If a connection is already in progress, wait for it
    if (!cached.promise) {
        // Create new connection promise
        cached.promise = (async () => {
            try {
                // Get MongoDB URI from environment variables
                const uri = process.env.MONGO_URI;
                
                if (!uri) {
                    throw new Error('MONGO_URI environment variable is not set');
                }

                // Create new MongoClient instance
                const client = new MongoClient(uri, {
                    // Connection options for better performance and reliability
                    maxPoolSize: 10,
                    minPoolSize: 1,
                    serverSelectionTimeoutMS: 5000,
                });

                // Connect to MongoDB Atlas
                await client.connect();

                // Get the database instance
                const db = client.db('chocair_fresh');

                // Cache the database connection
                cached.conn = db;

                return db;
            } catch (error) {
                // Clear the promise on error so we can retry
                cached.promise = null;
                throw error;
            }
        })();
    }

    // Wait for the connection to be established
    return await cached.promise;
}

