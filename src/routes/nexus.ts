import { Request, Response, Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { listData, setData, getData, pushData, id } from '../firebase';

const router = Router();

// GET all nexus posts
router.get('/posts', async (req: Request, res: Response) => {
    try {
        const posts = await listData('nexusPosts');
        // Attach user data to each post
        const populatedPosts = await Promise.all(posts.map(async (post) => {
            const author = await getData(`users/${post.authorId}`);
            return {
                ...post,
                authorName: author?.name || 'Unknown User',
                authorAvatar: author?.profileImage || null,
            };
        }));
        res.json({ success: true, posts: populatedPosts.sort((a, b) => b.createdAt.localeCompare(a.createdAt)) });
    } catch (err) {
        console.error('[Nexus] Get posts error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// POST a new nexus post
router.post('/posts', async (req: Request, res: Response) => {
    try {
        const requesterId = req.headers['x-user-id'] as string;
        if (!requesterId) {
            return res.status(401).json({ error: 'Unauthorized - User ID required' });
        }

        const { title, content, imageUrl } = req.body;
        if (!title || !content) {
            return res.status(400).json({ error: 'Title and content are required' });
        }

        const postId = id('nexus');
        const newPost = {
            id: postId,
            authorId: requesterId,
            title,
            content,
            imageUrl: imageUrl || null,
            createdAt: new Date().toISOString(),
            likes: [],
            comments: [],
        };

        await setData(`nexusPosts/${postId}`, newPost);
        res.status(201).json({ success: true, post: newPost });
    } catch (err) {
        console.error('[Nexus] Create post error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// POST to like/unlike a nexus post
router.post('/posts/:id/like', async (req: Request, res: Response) => {
    try {
        const requesterId = req.headers['x-user-id'] as string;
        if (!requesterId) {
            return res.status(401).json({ error: 'Unauthorized - User ID required' });
        }

        const { id } = req.params;
        const post = await getData(`nexusPosts/${id}`);
        if (!post) {
            return res.status(404).json({ error: 'Post not found' });
        }

        const likes = post.likes || [];
        const userHasLiked = likes.includes(requesterId);

        if (userHasLiked) {
            const updatedLikes = likes.filter((userId: string) => userId !== requesterId);
            await setData(`nexusPosts/${id}/likes`, updatedLikes);
        } else {
            await pushData(`nexusPosts/${id}/likes`, requesterId);
        }

        const updatedPost = await getData(`nexusPosts/${id}`);
        res.json({ success: true, likes: updatedPost.likes || [] });
    } catch (err) {
        console.error('[Nexus] Like post error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// POST a comment on a nexus post
router.post('/posts/:id/comment', async (req: Request, res: Response) => {
    try {
        const requesterId = req.headers['x-user-id'] as string;
        if (!requesterId) {
            return res.status(401).json({ error: 'Unauthorized - User ID required' });
        }
        const requester = await getData(`users/${requesterId}`);

        const { id } = req.params;
        const { text } = req.body;
        if (!text) {
            return res.status(400).json({ error: 'Comment text is required' });
        }

        const post = await getData(`nexusPosts/${id}`);
        if (!post) {
            return res.status(404).json({ error: 'Post not found' });
        }

        const commentId = uuidv4();
        const newComment = {
            id: commentId,
            userId: requesterId,
            userName: requester.name,
            userAvatar: requester.profileImage || null,
            text,
            createdAt: new Date().toISOString(),
        };

        await pushData(`nexusPosts/${id}/comments`, newComment);
        const updatedPost = await getData(`nexusPosts/${id}`);
        res.status(201).json({ success: true, comments: updatedPost.comments || [] });
    } catch (err) {
        console.error('[Nexus] Comment on post error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;