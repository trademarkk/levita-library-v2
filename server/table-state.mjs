function dateOnly(value) {
  if (!value) return new Date().toISOString().slice(0, 10);
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function timeOnly(value) {
  return value ? String(value).slice(0, 5) : null;
}

function nullable(value) {
  return value === undefined ? null : value;
}

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

async function run(query, action) {
  const { error } = await query;
  if (error) throw new Error(`Supabase ${action} failed: ${error.message}`);
}

async function selectTable(supabase, table, orderColumn = null, ascending = true) {
  let query = supabase.from(table).select('*');
  if (orderColumn) query = query.order(orderColumn, { ascending });
  const { data, error } = await query;
  if (error) throw new Error(`Supabase select ${table} failed: ${error.message}`);
  return data || [];
}

async function syncRows(supabase, table, rows, idColumn = 'id') {
  const normalizedRows = rows.filter((row) => row?.[idColumn]);
  const { data: existing, error } = await supabase.from(table).select(idColumn);
  if (error) throw new Error(`Supabase select ${table} ids failed: ${error.message}`);

  const nextIds = new Set(normalizedRows.map((row) => row[idColumn]));
  const staleIds = (existing || []).map((row) => row[idColumn]).filter((id) => !nextIds.has(id));
  if (staleIds.length) await run(supabase.from(table).delete().in(idColumn, staleIds), `delete stale ${table}`);
  if (normalizedRows.length) await run(supabase.from(table).upsert(normalizedRows, { onConflict: idColumn }), `upsert ${table}`);
}

async function replaceRows(supabase, table, rows, deleteColumn) {
  await run(supabase.from(table).delete().not(deleteColumn, 'is', null), `clear ${table}`);
  if (rows.length) await run(supabase.from(table).insert(rows), `insert ${table}`);
}

function rowsFromState(state) {
  const now = new Date().toISOString();
  const userIds = new Set((state.users || []).map((user) => user.id));
  const taskIds = new Set((state.tasks || []).map((task) => task.id));
  const checklistItems = [];
  const checklistReports = [];
  const financialRows = [];
  const financialPayments = [];
  const userRef = (id) => (id && userIds.has(id) ? id : null);
  const taskRef = (id) => (id && taskIds.has(id) ? id : null);

  for (const checklist of state.checklists || []) {
    (checklist.items || []).forEach((item, index) => {
      checklistItems.push({
        id: item.id,
        checklist_id: checklist.id,
        label: item.label,
        completed: Boolean(item.completed),
        completed_at: nullable(item.completedAt),
        completed_by: userRef(item.completedBy),
        position: index,
      });
    });
    (checklist.reports || []).forEach((report) => {
      checklistReports.push({
        id: `${checklist.id}:${report.slot}`,
        checklist_id: checklist.id,
        slot: report.slot,
        studio: report.studio || 'STAVROPOLSKAYA',
        admin_name: report.adminName || '',
        calls: report.calls || '',
        reached: report.reached || '',
        bookings: report.bookings || '',
        cash: report.cash || '',
        came: report.came || '',
        bought: report.bought || '',
        submitted_at: nullable(report.submittedAt),
        sent_to_telegram: Boolean(report.sentToTelegram),
        telegram_sent_at: nullable(report.telegramSentAt),
        sent_to_max: Boolean(report.sentToMax),
        max_sent_at: nullable(report.maxSentAt),
        max_send_error: nullable(report.maxSendError),
        max_message_id: nullable(report.maxMessageId),
      });
    });
  }

  for (const plan of state.financialPlans || []) {
    (plan.rows || []).forEach((row, index) => {
      const storageRowId = `${plan.month}:${row.id}`;
      financialRows.push({ id: storageRowId, month: plan.month, title: row.title, position: index, updated_at: now });
      Object.entries(row.payments || {}).forEach(([paymentDate, value]) => {
        const isPaid = Boolean(row.paidPayments?.[paymentDate]);
        financialPayments.push({
          row_id: storageRowId,
          payment_date: paymentDate,
          value: String(value ?? ''),
          is_paid: isPaid,
          paid_at: isPaid ? now : null,
          updated_at: now,
        });
      });
    });
  }

  return {
    users: (state.users || []).map((user) => ({
      id: user.id,
      name: user.name,
      email: normalizeEmail(user.email),
      password_hash: user.passwordHash || null,
      legacy_password: user.password || null,
      role: user.role,
      status: user.status || 'active',
      join_date: user.joinDate || '',
      created_at: user.createdAt || now,
      updated_at: now,
    })),
    tasks: (state.tasks || []).map((task) => ({
      id: task.id,
      title: task.title,
      description: task.description || '',
      period: task.period || '',
      role: task.role,
      priority: task.priority || 'medium',
      status: task.status || 'pending',
      deadline: nullable(task.deadline),
      add_to_calendar: Boolean(task.addToCalendar),
      calendar_event_id: nullable(task.calendarEventId),
      created_at: task.createdAt || now,
      updated_at: now,
    })),
    response_templates: (state.templates || []).map((template) => ({
      id: template.id,
      title: template.title,
      body: template.body,
      role: template.role,
      business_model: template.businessModel || 'ALL',
      purpose: nullable(template.purpose),
      created_by_id: userRef(template.createdById),
      created_at: template.createdAt || now,
      updated_at: now,
    })),
    helpful_links: (state.links || []).map((link) => ({
      id: link.id,
      title: link.title,
      url: link.url,
      category: link.category || 'HELPFUL',
      role: link.role,
      description: nullable(link.description),
      created_at: link.createdAt || now,
      updated_at: now,
    })),
    document_templates: (state.documentTemplates || []).map((template) => ({
      id: template.id,
      title: template.title,
      url: template.url,
      created_by_id: userRef(template.createdById),
      created_at: template.createdAt || now,
      updated_at: now,
    })),
    useful_contacts: (state.usefulContacts || []).map((contact) => ({
      id: contact.id,
      name: contact.name,
      phone: contact.phone,
      company: contact.company,
      specialty: contact.specialty,
      created_at: contact.createdAt || now,
      updated_at: now,
    })),
    knowledge_entries: (state.knowledge || []).map((entry) => ({
      id: entry.id,
      title: entry.title,
      content: entry.content,
      regulation_url: nullable(entry.regulationUrl),
      role: entry.role,
      category: entry.category,
      business_model: entry.businessModel || 'ALL',
      hashtags: nullable(entry.hashtags),
      is_actual: entry.isActual !== false,
      searchable: entry.searchable !== false,
      video_url: nullable(entry.videoUrl),
      created_at: entry.createdAt || now,
      updated_at: now,
    })),
    content_attachments: (state.knowledge || []).flatMap((entry) => (
      (entry.attachments || []).map((attachment, position) => ({
        id: attachment.id,
        knowledge_entry_id: entry.id,
        storage_path: attachment.storagePath || `${entry.id}/${attachment.id}`,
        file_name: attachment.fileName,
        mime_type: attachment.mimeType,
        size_bytes: attachment.sizeBytes,
        position: attachment.position ?? position,
        created_at: attachment.createdAt || now,
      }))
    )),
    content_favorites: (state.favorites || []).map((favorite) => ({
      id: favorite.id,
      user_id: favorite.userId,
      entity_type: favorite.entityType,
      entity_id: favorite.entityId,
      created_at: favorite.createdAt || now,
    })),
    content_read_receipts: (state.readReceipts || []).map((receipt) => ({
      id: receipt.id,
      user_id: receipt.userId,
      entity_type: 'knowledge',
      entity_id: receipt.entityId,
      read_at: receipt.readAt || now,
    })),
    daily_checklists: (state.checklists || []).map((checklist) => ({
      id: checklist.id,
      title: checklist.title,
      role: checklist.role,
      assigned_to: checklist.assignedTo,
      checklist_date: dateOnly(checklist.date),
      created_at: checklist.createdAt || now,
      updated_at: now,
    })),
    checklist_items: checklistItems,
    checklist_reports: checklistReports,
    refunds: (state.refunds || []).map((refund) => ({
      id: refund.id,
      client_name: refund.clientName,
      requested_at: refund.requestedAt,
      amount: Number(refund.amount) || 0,
      reason: refund.reason,
      status: refund.status,
      comment: nullable(refund.comment),
      created_at: refund.createdAt || now,
      updated_at: now,
    })),
    financial_plan_months: (state.financialPlans || []).map((plan) => ({ month: plan.month, updated_at: now })),
    financial_plan_rows: financialRows,
    financial_plan_payments: financialPayments,
    calendar_events: (state.calendarEvents || []).map((event) => ({
      id: event.id,
      title: event.title,
      event_date: dateOnly(event.date),
      start_time: timeOnly(event.startTime),
      end_time: timeOnly(event.endTime),
      description: nullable(event.description),
      source_task_id: taskRef(event.sourceTaskId),
      google_event_id: nullable(event.googleEventId),
      google_recurring_event_id: nullable(event.googleRecurringEventId),
      google_html_link: nullable(event.googleHtmlLink),
      google_sync_status: nullable(event.googleSyncStatus),
      google_sync_error: nullable(event.googleSyncError),
      source: nullable(event.source),
      source_name: nullable(event.sourceName),
      recurrence: event.recurrence || null,
      created_at: event.createdAt || now,
      updated_at: now,
    })),
    expense_categories: (state.expenseCategories || []).map((category) => ({ id: category.id, name: category.name, created_at: category.createdAt || now })),
    expenses: (state.expenses || []).map((expense) => ({
      id: expense.id,
      expense_date: dateOnly(expense.date),
      amount: Number(expense.amount) || 0,
      account: expense.account,
      category: expense.category,
      studio: expense.studio,
      previous_month_credit: Boolean(expense.previousMonthCredit),
      comment: nullable(expense.comment),
      created_at: expense.createdAt || now,
      updated_at: now,
    })),
    trainer_evaluation_sheets: (state.trainerEvaluations || []).map((evaluation) => ({
      id: evaluation.id,
      trainer_name: evaluation.trainerName,
      studio: evaluation.studio,
      direction: evaluation.direction,
      score: Number(evaluation.score) || 0,
      evaluated_at: dateOnly(evaluation.evaluatedAt),
      sheet_url: evaluation.sheetUrl,
      created_by_id: userRef(evaluation.createdById),
      created_at: evaluation.createdAt || now,
      updated_at: now,
    })),
    call_reviews: (state.callReviews || []).map((review) => ({
      id: review.id,
      source: review.source || 'levita-calls',
      external_id: review.externalId,
      admin_name: review.adminName,
      studio: review.studio,
      score: Number(review.score) || 0,
      reviewed_at: dateOnly(review.reviewedAt),
      amo_crm_deal_url: nullable(review.amoCrmDealUrl),
      call_url: nullable(review.callUrl),
      original_filename: nullable(review.originalFilename),
      comment: nullable(review.comment),
      created_at: review.createdAt || now,
      updated_at: review.updatedAt || now,
    })),
    call_checklist_items: (state.callChecklist || []).map((label, index) => ({ id: `call-checklist-${index + 1}`, label, position: index, updated_at: now })),
    admin_shifts: (state.adminShifts || []).filter((shift) => userIds.has(shift.userId)).map((shift) => ({
      id: shift.id,
      user_id: shift.userId,
      admin_name: shift.adminName,
      studio: shift.studio,
      shift_date: dateOnly(shift.date),
      started_at: shift.startedAt,
      reminders_scheduled_at: nullable(shift.remindersScheduledAt),
      reminder_schedule_error: nullable(shift.reminderScheduleError),
      updated_at: now,
    })),
    audit_log: (state.auditLog || []).map((entry) => ({
      id: entry.id,
      action: entry.action,
      entity_type: entry.entityType,
      entity_id: nullable(entry.entityId),
      entity_label: entry.entityLabel,
      description: nullable(entry.description),
      actor_id: userRef(entry.actorId),
      actor_name: entry.actorName,
      actor_role: nullable(entry.actorRole),
      created_at: entry.createdAt || now,
    })),
    app_settings: [{ id: 'main', payload: state.settings || {}, updated_at: now }],
  };
}

function mapUser(row) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    passwordHash: row.password_hash || undefined,
    password: row.legacy_password || undefined,
    role: row.role,
    status: row.status,
    joinDate: row.join_date || '',
    createdAt: row.created_at,
  };
}

export async function readStateFromTables(supabase) {
  const [
    users, tasks, templates, links, documentTemplates, usefulContacts, knowledge, contentAttachments, favorites, readReceipts,
    checklists, checklistItems, checklistReports, refunds, financialMonths, financialRows, financialPayments,
    calendarEvents, expenseCategories, expenses, trainerEvaluations, callReviews, callChecklistItems,
    adminShifts, auditLog, settingsRows,
  ] = await Promise.all([
    selectTable(supabase, 'users', 'created_at'),
    selectTable(supabase, 'tasks', 'created_at'),
    selectTable(supabase, 'response_templates', 'created_at'),
    selectTable(supabase, 'helpful_links', 'created_at'),
    selectTable(supabase, 'document_templates', 'created_at'),
    selectTable(supabase, 'useful_contacts', 'created_at'),
    selectTable(supabase, 'knowledge_entries', 'created_at'),
    selectTable(supabase, 'content_attachments', 'position'),
    selectTable(supabase, 'content_favorites', 'created_at'),
    selectTable(supabase, 'content_read_receipts', 'read_at'),
    selectTable(supabase, 'daily_checklists', 'checklist_date'),
    selectTable(supabase, 'checklist_items', 'position'),
    selectTable(supabase, 'checklist_reports', 'slot'),
    selectTable(supabase, 'refunds', 'requested_at', false),
    selectTable(supabase, 'financial_plan_months', 'month'),
    selectTable(supabase, 'financial_plan_rows', 'position'),
    selectTable(supabase, 'financial_plan_payments', 'payment_date'),
    selectTable(supabase, 'calendar_events', 'event_date'),
    selectTable(supabase, 'expense_categories', 'created_at'),
    selectTable(supabase, 'expenses', 'expense_date', false),
    selectTable(supabase, 'trainer_evaluation_sheets', 'evaluated_at', false),
    selectTable(supabase, 'call_reviews', 'reviewed_at', false),
    selectTable(supabase, 'call_checklist_items', 'position'),
    selectTable(supabase, 'admin_shifts', 'started_at', false),
    selectTable(supabase, 'audit_log', 'created_at', false),
    selectTable(supabase, 'app_settings'),
  ]);

  if (!users.length && !knowledge.length && !checklists.length) return null;

  const itemsByChecklist = new Map();
  for (const item of checklistItems) {
    const list = itemsByChecklist.get(item.checklist_id) || [];
    list.push({ id: item.id, label: item.label, completed: Boolean(item.completed), completedAt: item.completed_at, completedBy: item.completed_by });
    itemsByChecklist.set(item.checklist_id, list);
  }

  const reportsByChecklist = new Map();
  for (const report of checklistReports) {
    const list = reportsByChecklist.get(report.checklist_id) || [];
    list.push({
      slot: report.slot,
      studio: report.studio || 'STAVROPOLSKAYA',
      adminName: report.admin_name,
      calls: report.calls || '',
      reached: report.reached || '',
      bookings: report.bookings || '',
      cash: report.cash || '',
      came: report.came || '',
      bought: report.bought || '',
      submittedAt: report.submitted_at,
      sentToTelegram: Boolean(report.sent_to_telegram),
      telegramSentAt: report.telegram_sent_at,
      sentToMax: Boolean(report.sent_to_max),
      maxSentAt: report.max_sent_at,
      maxSendError: report.max_send_error,
      maxMessageId: report.max_message_id,
    });
    reportsByChecklist.set(report.checklist_id, list);
  }

  const paymentsByRow = new Map();
  const paidPaymentsByRow = new Map();
  for (const payment of financialPayments) {
    const payments = paymentsByRow.get(payment.row_id) || {};
    payments[payment.payment_date] = payment.value || '';
    paymentsByRow.set(payment.row_id, payments);
    if (payment.is_paid) {
      const paidPayments = paidPaymentsByRow.get(payment.row_id) || {};
      paidPayments[payment.payment_date] = true;
      paidPaymentsByRow.set(payment.row_id, paidPayments);
    }
  }

  const rowsByMonth = new Map();
  for (const row of financialRows) {
    const list = rowsByMonth.get(row.month) || [];
    list.push({
      id: row.id,
      title: row.title,
      payments: paymentsByRow.get(row.id) || {},
      paidPayments: paidPaymentsByRow.get(row.id) || {},
    });
    rowsByMonth.set(row.month, list);
  }

  const settings = settingsRows.find((row) => row.id === 'main')?.payload || { colorMode: 'dark', density: 'comfortable', animations: true, telegramReports: true };
  const attachmentsByEntry = new Map();
  for (const attachment of contentAttachments) {
    const list = attachmentsByEntry.get(attachment.knowledge_entry_id) || [];
    list.push({
      id: attachment.id,
      knowledgeEntryId: attachment.knowledge_entry_id,
      storagePath: attachment.storage_path,
      fileName: attachment.file_name,
      mimeType: attachment.mime_type,
      sizeBytes: Number(attachment.size_bytes) || 0,
      position: Number(attachment.position) || 0,
      createdAt: attachment.created_at,
      url: `/api/content-attachments/${encodeURIComponent(attachment.id)}`,
    });
    attachmentsByEntry.set(attachment.knowledge_entry_id, list);
  }
  const updatedAt = [...users, ...tasks, ...knowledge, ...checklists, ...calendarEvents, ...callReviews]
    .map((row) => row.updated_at || row.created_at)
    .filter(Boolean)
    .sort()
    .at(-1) || new Date().toISOString();

  return {
    updatedAt,
    state: {
      schemaVersion: 3,
      users: users.map(mapUser),
      tasks: tasks.map((task) => ({ id: task.id, title: task.title, description: task.description || '', period: task.period || '', role: task.role, priority: task.priority, status: task.status, deadline: task.deadline, addToCalendar: Boolean(task.add_to_calendar), calendarEventId: task.calendar_event_id, createdAt: task.created_at })),
      templates: templates.map((template) => ({ id: template.id, title: template.title, body: template.body, role: template.role, businessModel: template.business_model, purpose: template.purpose, createdById: template.created_by_id, createdAt: template.created_at })),
      links: links.map((link) => ({ id: link.id, title: link.title, url: link.url, category: link.category, role: link.role, description: link.description, createdAt: link.created_at })),
      documentTemplates: documentTemplates.map((template) => ({ id: template.id, title: template.title, url: template.url, createdById: template.created_by_id, createdAt: template.created_at })),
      usefulContacts: usefulContacts.map((contact) => ({ id: contact.id, name: contact.name, phone: contact.phone, company: contact.company, specialty: contact.specialty, createdAt: contact.created_at })),
      knowledge: knowledge.map((entry) => ({ id: entry.id, title: entry.title, content: entry.content, regulationUrl: entry.regulation_url, role: entry.role, category: entry.category, businessModel: entry.business_model, hashtags: entry.hashtags, isActual: entry.is_actual, searchable: entry.searchable, videoUrl: entry.video_url, attachments: attachmentsByEntry.get(entry.id) || [], createdAt: entry.created_at })),
      checklists: checklists.map((checklist) => ({ id: checklist.id, title: checklist.title, role: checklist.role, assignedTo: checklist.assigned_to, date: checklist.checklist_date, createdAt: checklist.created_at, items: itemsByChecklist.get(checklist.id) || [], reports: reportsByChecklist.get(checklist.id) || [] })),
      refunds: refunds.map((refund) => ({ id: refund.id, clientName: refund.client_name, requestedAt: refund.requested_at, amount: Number(refund.amount) || 0, reason: refund.reason, status: refund.status, comment: refund.comment, createdAt: refund.created_at })),
      financialPlans: financialMonths.map((month) => ({ month: month.month, rows: rowsByMonth.get(month.month) || [] })),
      calendarEvents: calendarEvents.map((event) => ({ id: event.id, title: event.title, date: event.event_date, startTime: event.start_time, endTime: event.end_time, description: event.description, sourceTaskId: event.source_task_id, googleEventId: event.google_event_id, googleRecurringEventId: event.google_recurring_event_id, googleHtmlLink: event.google_html_link, googleSyncStatus: event.google_sync_status, googleSyncError: event.google_sync_error, source: event.source, sourceName: event.source_name, recurrence: event.recurrence, createdAt: event.created_at })),
      expenseCategories: expenseCategories.map((category) => ({ id: category.id, name: category.name, createdAt: category.created_at })),
      expenses: expenses.map((expense) => ({ id: expense.id, date: expense.expense_date, amount: Number(expense.amount) || 0, account: expense.account, category: expense.category, studio: expense.studio, previousMonthCredit: Boolean(expense.previous_month_credit), comment: expense.comment, createdAt: expense.created_at })),
      trainerEvaluations: trainerEvaluations.map((evaluation) => ({ id: evaluation.id, trainerName: evaluation.trainer_name, studio: evaluation.studio, direction: evaluation.direction, score: Number(evaluation.score) || 0, evaluatedAt: evaluation.evaluated_at, sheetUrl: evaluation.sheet_url, createdById: evaluation.created_by_id, createdAt: evaluation.created_at })),
      callReviews: callReviews.map((review) => ({ id: review.id, source: review.source || 'levita-calls', externalId: review.external_id, adminName: review.admin_name, studio: review.studio, score: Number(review.score) || 0, reviewedAt: review.reviewed_at, amoCrmDealUrl: review.amo_crm_deal_url, callUrl: review.call_url, originalFilename: review.original_filename, comment: review.comment, createdAt: review.created_at, updatedAt: review.updated_at })),
      favorites: favorites.map((favorite) => ({ id: favorite.id, userId: favorite.user_id, entityType: favorite.entity_type, entityId: favorite.entity_id, createdAt: favorite.created_at })),
      readReceipts: readReceipts.map((receipt) => ({ id: receipt.id, userId: receipt.user_id, entityType: 'knowledge', entityId: receipt.entity_id, readAt: receipt.read_at })),
      callChecklist: callChecklistItems.map((item) => item.label),
      adminShifts: adminShifts.map((shift) => ({ id: shift.id, userId: shift.user_id, adminName: shift.admin_name, studio: shift.studio, date: shift.shift_date, startedAt: shift.started_at, remindersScheduledAt: shift.reminders_scheduled_at, reminderScheduleError: shift.reminder_schedule_error })),
      auditLog: auditLog.map((entry) => ({ id: entry.id, action: entry.action, entityType: entry.entity_type, entityId: entry.entity_id, entityLabel: entry.entity_label, description: entry.description, actorId: entry.actor_id, actorName: entry.actor_name, actorRole: entry.actor_role, createdAt: entry.created_at })),
      settings,
    },
  };
}

export async function writeStateToTables(supabase, state) {
  const rows = rowsFromState(state);
  await syncRows(supabase, 'users', rows.users);
  await syncRows(supabase, 'tasks', rows.tasks);
  await syncRows(supabase, 'response_templates', rows.response_templates);
  await syncRows(supabase, 'helpful_links', rows.helpful_links);
  await syncRows(supabase, 'document_templates', rows.document_templates);
  await syncRows(supabase, 'useful_contacts', rows.useful_contacts);
  await syncRows(supabase, 'knowledge_entries', rows.knowledge_entries);
  await syncRows(supabase, 'content_attachments', rows.content_attachments);
  await syncRows(supabase, 'content_favorites', rows.content_favorites);
  await syncRows(supabase, 'content_read_receipts', rows.content_read_receipts);
  await syncRows(supabase, 'daily_checklists', rows.daily_checklists);
  await syncRows(supabase, 'checklist_items', rows.checklist_items);
  await syncRows(supabase, 'checklist_reports', rows.checklist_reports);
  await syncRows(supabase, 'refunds', rows.refunds);
  await syncRows(supabase, 'financial_plan_months', rows.financial_plan_months, 'month');
  await syncRows(supabase, 'financial_plan_rows', rows.financial_plan_rows);
  await replaceRows(supabase, 'financial_plan_payments', rows.financial_plan_payments, 'row_id');
  await syncRows(supabase, 'calendar_events', rows.calendar_events);
  await syncRows(supabase, 'expense_categories', rows.expense_categories);
  await syncRows(supabase, 'expenses', rows.expenses);
  await syncRows(supabase, 'trainer_evaluation_sheets', rows.trainer_evaluation_sheets);
  await syncRows(supabase, 'call_reviews', rows.call_reviews);
  await syncRows(supabase, 'call_checklist_items', rows.call_checklist_items);
  await syncRows(supabase, 'admin_shifts', rows.admin_shifts);
  await syncRows(supabase, 'audit_log', rows.audit_log);
  await syncRows(supabase, 'app_settings', rows.app_settings);
  return { state, updatedAt: new Date().toISOString() };
}
