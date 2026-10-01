/**
 * policy command - Governance policy simulation, template inspection, and edge caching
 */

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { getApiEndpoint, getApiKey } from '../lib/config';
import { log, printHeader, printKeyValue, formatTable } from '../lib/output';

export const policyCommand = new Command('policy')
  .description('Governance policy simulation, templates, and edge evaluation cache');

// 1. lf policy list
policyCommand
  .command('list')
  .description('List prepackaged governance policy templates')
  .option('--category <category>', 'Filter by category (core, usage, ai, enterprise)')
  .option('--json', 'Output response in JSON format')
  .action(async (options: { category?: string; json?: boolean }) => {
    const templates = [
      { id: 'pol_eu_ai_act', name: 'EU AI Act Tier-1 Compliance', category: 'ai', risk: 'high', region: 'eu-west' },
      { id: 'pol_finops_budget_cap', name: 'FinOps Dynamic Budget Hard-Cap', category: 'usage', risk: 'medium', region: 'global' },
      { id: 'pol_hitl_privileged_tool', name: 'M-of-N Destructive Action Gate', category: 'enterprise', risk: 'destructive', region: 'global' },
      { id: 'pol_agent_token_quota', name: 'Agent Sliding Window Rate Limit', category: 'ai', risk: 'low', region: 'global' },
      { id: 'pol_sovereign_data_boundary', name: 'Sovereign Healthcare Geofence', category: 'enterprise', risk: 'critical', region: 'eu-west' },
      { id: 'pol_model_circuit_breaker', name: 'Cascade Failover Auto-Downgrade', category: 'core', risk: 'medium', region: 'global' },
    ];

    const filtered = options.category
      ? templates.filter(t => t.category.toLowerCase() === options.category?.toLowerCase())
      : templates;

    if (options.json) {
      console.log(JSON.stringify(filtered, null, 2));
      return;
    }

    printHeader('Prepackaged Governance Policy Templates');
    const tableData = [
      ['Template ID', 'Name', 'Category', 'Risk Level', 'Region'],
      ...filtered.map(t => [
        chalk.cyan(t.id),
        t.name,
        chalk.blue(t.category),
        t.risk === 'destructive' || t.risk === 'critical' ? chalk.red(t.risk) : chalk.yellow(t.risk),
        chalk.magenta(t.region)
      ])
    ];

    console.log(formatTable(tableData));
    log.info(`Showing ${filtered.length} governance policy templates.`);
  });

// 2. lf policy simulate
policyCommand
  .command('simulate')
  .description('Simulate an explainable policy decision locally or against the control plane')
  .requiredOption('-s, --subject <id>', 'Subject identifier (e.g. agent:financial_bot_01)')
  .requiredOption('-r, --resource <id>', 'Target resource (e.g. model:gpt-4o or mcp_tool:stripe:refund)')
  .option('-a, --action <action>', 'Action requested', 'execute')
  .option('-e, --environment <env>', 'Target environment', 'production')
  .option('--region <region>', 'Target region', 'global')
  .option('--json', 'Output decision as raw JSON')
  .action(async (options: {
    subject: string;
    resource: string;
    action: string;
    environment: string;
    region: string;
    json?: boolean;
  }) => {
    const spinner = ora('Evaluating deterministic policy precedence rules...').start();
    const startTime = performance.now();

    // Deterministic simulation rules
    let decision: 'allow' | 'deny' | 'conditional' | 'throttle' | 'require approval' | 'route' = 'allow';
    let allowed = true;
    let reason = 'Request satisfies all active policy boundaries and quota constraints';
    let matchedRule = 'RULE_DEFAULT_PERMIT';

    if (options.subject.includes('quarantined') || options.resource.includes('blacklisted')) {
      decision = 'deny';
      allowed = false;
      reason = 'Precedence 1 — Subject or resource is under active emergency quarantine kill switch';
      matchedRule = 'EMERGENCY_QUARANTINE';
    } else if (options.region === 'eu-west' && options.resource.includes('unapproved_us_model')) {
      decision = 'deny';
      allowed = false;
      reason = 'Precedence 2 — Data residency violation: Non-EU model invocation blocked within sovereign boundary';
      matchedRule = 'SOVEREIGN_RESIDENCY_GATE';
    } else if (options.resource.includes('destructive') || options.action === 'drop_database' || options.action === 'refund_payout') {
      decision = 'require approval';
      allowed = false;
      reason = 'Precedence 4 — Destructive action requires M-of-N multi-party quorum authorization';
      matchedRule = 'HITL_APPROVAL_GATE';
    }

    const latencyMs = parseFloat((performance.now() - startTime).toFixed(3));
    spinner.stop();

    const decisionObject = {
      decision,
      allowed,
      subject: options.subject,
      resource: options.resource,
      action: options.action,
      environment: options.environment,
      region: options.region,
      reason,
      matched_rule: matchedRule,
      evaluated_at: new Date().toISOString(),
      latency_ms: latencyMs,
    };

    if (options.json) {
      console.log(JSON.stringify(decisionObject, null, 2));
      return;
    }

    printHeader('Explainable Policy Simulator Decision');
    printKeyValue('Decision', allowed ? chalk.green.bold(decision.toUpperCase()) : chalk.red.bold(decision.toUpperCase()));
    printKeyValue('Allowed', allowed ? chalk.green('true') : chalk.red('false'));
    printKeyValue('Subject', options.subject);
    printKeyValue('Resource', options.resource);
    printKeyValue('Action', options.action);
    printKeyValue('Environment', options.environment);
    printKeyValue('Region', options.region);
    printKeyValue('Matched Rule', chalk.cyan(matchedRule));
    printKeyValue('Reason', reason);
    printKeyValue('Evaluation Latency', chalk.magenta(`${latencyMs} ms`));
  });
