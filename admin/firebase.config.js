import admin from "firebase-admin";
import dotenv from "dotenv";

dotenv.config();

const serviceAccount = {
  type: "service_account",
  project_id: "pretypet-abd98",
  private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
  private_key:
    "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDDYnjnkLJG/IRM\nL4YL8hIW1Hiv4x0AQsui1f5sx0oGc+HE8ADbupW6uR/JwJ432IMXu2dFMvB7Ysvg\nwLFh9oJFKwqa3wwwNHhCp9i6TrUJVhW0r1RY6jcv7HzDLts8k3eaaXgZHIBj2q+5\n9A5EqmJgPMpuB0icTwMgPt4N1XACkkyCEI241F0gRhj7u88MACuzaYT1fsFeAVx2\ngmlCF7BlsAPZDJHWYrU8c8NjFihvhKfsvtJNudq6x8Ke7oNTdmlcEbCLU3y37DoJ\nz9EIYK5X82l+gDeQZOkf7Wr0Szz9FtPFa0kaktOiq1bK/iP9roKcQpAQHLtLqj9D\n5mXRwH2jAgMBAAECggEAN1XvSh4X77Tavz0CaOWxK9gXKjFXaFiCleanfSVgGL2/\nJmiWxaRtfYmqsBgmd0iRsCn6UIXhyAAuH8RTOJx5Pp+3DC+5ovlpSe+BmRpreW5x\nDVBOwjPrV15R43Gk094sFIZkZjBFSIKKHE87r0TWQc1Vw526edKC3yIO/7oAVCme\nS8LnddIYt5R+T5+IFti1nOedMp8A6IEqim6rP5ozbUpFgN1yjwHpwBlRboTiM16D\n6rezn4Gvubdw4cgnN7dNNkNjuf04eqJ2m/9wl8YtOPBiyi23cI06JQaqqu0Y1kLr\nrvQrPB/tVeTrZAQ8FCUrrAGxerAea0LMvAV1CqhBsQKBgQDonBH5Mq7gaqgqTpUV\nNL1b14EKEHqrRoxBlJQbOALRPDiS3kxEa7xs4wI89oybMEKBSx1q7J7a+hHouAOG\npOf8G2zFgs7uW+mkITtMW6VLblJFOHTMDha7zK2Mw0mGCqlXvJmiGLbH5l3xsF4k\nIj8ZJhO4SlOuZbovpGHnK8gHOwKBgQDXCCQ+ei5HfTsZB/ZcL35VXE/WrfQ+0D8X\n7794a2hz+YrSi3YX+o1yJ2PZe9s01ad6u+V6bHdSZ6MST0jC5MffeRoSD3hJySnj\n8//iNimIPzdpx4GqyN8nGfHgWUGMh9DqFd5aP6y3yK8xUIfciyH04tybKejeLaCd\n+f4oAM2MuQKBgQCjxW6qI1MY0j9AOj+gxJcl2J8TtPKJMIyDh9aXK2JgaqPyU+0i\npy/tAg+LWJM6mEnaukYmCB74UeTWEuj4nZZv2+dDUIvdKn1ff74+TrAcYbou3kbt\nfGXpJ3xxhPV5GHyON0174Safq8Qs7F371tjSHgr4T+yG9zyVWolLt3mIDQKBgBWW\n56yuL79Vv30/42hWDGUdo5Z2WLOFzQ/mLl80yYP7ZgjFn9HAgjsX4VqQqO2hFfOo\nsd2czk4jwaew9ik7NyYkzo1JqFYgMGiGswZPUdQwJKwmL8qp6F3QqQxRaddmO3+F\nOpHtGrZJG+3jnAB0p7AipuudRZgpFJtH4lC54+lhAoGANpMikNHHgnspjnrXQss+\ndEhx3iLSt3tZW9Jjex/aRTj81lrdwO1rozSszBA/oTbKIqGrlhPiBhODQre44N+A\nPMf4XA+Bl+mx8s2Gt9hNcCK5gjn7ttUwHEb68966gZQXDfZI19Qe5oPPfivw0Jca\nzf98XD6QdcNYeKcwd2a26Y0=\n-----END PRIVATE KEY-----\n",
  client_email: process.env.FIREBASE_CLIENT_EMAIL,
  client_id: process.env.FIREBASE_CLIENT_ID,
  auth_uri: "https://accounts.google.com/o/oauth2/auth",
  token_uri: "https://oauth2.googleapis.com/token",
  auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
  client_x509_cert_url:
    "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-fbsvc%40pretypet-abd98.iam.gserviceaccount.com",
  universe_domain: "googleapis.com",
};

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

export default admin;
