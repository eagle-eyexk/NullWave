import { Router, type IRouter } from "express";
import { and, desc, eq, sql } from "drizzle-orm";
import {
  CreateConversationBody,
  CreateConversationResponse,
  DeleteConversationParams,
  ListConversationMessagesParams,
  ListConversationMessagesResponse,
  ListConversationsResponse,
  SendConversationMessageBody,
  SendConversationMessageParams,
  SendConversationMessageResponse,
} from "@workspace/api-zod";
import { db, conversationsTable, messagesTable } from "@workspace/db";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/require-auth";

const router: IRouter = Router();

router.use("/conversations", requireAuth);

router.get("/conversations", async (req, res): Promise<void> => {
  const userId = (req as AuthenticatedRequest).userId;
  const rows = await db
    .select({
      id: conversationsTable.id,
      title: conversationsTable.title,
      kind: conversationsTable.kind,
      createdAt: conversationsTable.createdAt,
      updatedAt: conversationsTable.updatedAt,
      lastMessage: sql<string | null>`(
        select ${messagesTable.content}
        from ${messagesTable}
        where ${messagesTable.conversationId} = ${conversationsTable.id}
        order by ${messagesTable.createdAt} desc
        limit 1
      )`,
      messageCount: sql<number>`(
        select count(*)::int
        from ${messagesTable}
        where ${messagesTable.conversationId} = ${conversationsTable.id}
      )`,
    })
    .from(conversationsTable)
    .where(eq(conversationsTable.ownerId, userId))
    .orderBy(desc(conversationsTable.updatedAt));

  res.json(ListConversationsResponse.parse(rows));
});

router.post("/conversations", async (req, res): Promise<void> => {
  const parsed = CreateConversationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Conversation details are invalid." });
    return;
  }

  const userId = (req as AuthenticatedRequest).userId;
  const [conversation] = await db
    .insert(conversationsTable)
    .values({
      ownerId: userId,
      title: parsed.data.title.trim(),
      kind: parsed.data.kind,
    })
    .returning();

  res
    .status(201)
    .json(
      CreateConversationResponse.parse({
        ...conversation,
        lastMessage: null,
        messageCount: 0,
      }),
    );
});

router.get(
  "/conversations/:conversationId/messages",
  async (req, res): Promise<void> => {
    const params = ListConversationMessagesParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: "Conversation ID is invalid." });
      return;
    }

    const userId = (req as AuthenticatedRequest).userId;
    const [conversation] = await db
      .select({ id: conversationsTable.id })
      .from(conversationsTable)
      .where(
        and(
          eq(conversationsTable.id, params.data.conversationId),
          eq(conversationsTable.ownerId, userId),
        ),
      )
      .limit(1);

    if (!conversation) {
      res.status(404).json({ error: "Conversation not found." });
      return;
    }

    const rows = await db
      .select({
        id: messagesTable.id,
        conversationId: messagesTable.conversationId,
        senderId: messagesTable.senderId,
        content: messagesTable.content,
        createdAt: messagesTable.createdAt,
      })
      .from(messagesTable)
      .where(eq(messagesTable.conversationId, conversation.id))
      .orderBy(desc(messagesTable.createdAt))
      .limit(200);

    res.json(ListConversationMessagesResponse.parse(rows.reverse()));
  },
);

router.post(
  "/conversations/:conversationId/messages",
  async (req, res): Promise<void> => {
    const params = SendConversationMessageParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: "Conversation ID is invalid." });
      return;
    }

    const parsed = SendConversationMessageBody.safeParse(req.body);
    if (!parsed.success || parsed.data.content.trim().length === 0) {
      res.status(400).json({ error: "Message content is required." });
      return;
    }

    const userId = (req as AuthenticatedRequest).userId;
    const [conversation] = await db
      .select({ id: conversationsTable.id })
      .from(conversationsTable)
      .where(
        and(
          eq(conversationsTable.id, params.data.conversationId),
          eq(conversationsTable.ownerId, userId),
        ),
      )
      .limit(1);

    if (!conversation) {
      res.status(404).json({ error: "Conversation not found." });
      return;
    }

    const [message] = await db
      .insert(messagesTable)
      .values({
        conversationId: conversation.id,
        senderId: userId,
        content: parsed.data.content,
      })
      .returning({
        id: messagesTable.id,
        conversationId: messagesTable.conversationId,
        senderId: messagesTable.senderId,
        content: messagesTable.content,
        createdAt: messagesTable.createdAt,
      });

    await db
      .update(conversationsTable)
      .set({ updatedAt: message.createdAt })
      .where(eq(conversationsTable.id, conversation.id));

    res
      .status(201)
      .json(SendConversationMessageResponse.parse(message));
  },
);

router.delete(
  "/conversations/:conversationId",
  async (req, res): Promise<void> => {
    const params = DeleteConversationParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: "Conversation ID is invalid." });
      return;
    }

    const userId = (req as AuthenticatedRequest).userId;
    const [deleted] = await db
      .delete(conversationsTable)
      .where(
        and(
          eq(conversationsTable.id, params.data.conversationId),
          eq(conversationsTable.ownerId, userId),
        ),
      )
      .returning({ id: conversationsTable.id });

    if (!deleted) {
      res.status(404).json({ error: "Conversation not found." });
      return;
    }

    res.sendStatus(204);
  },
);

export default router;
