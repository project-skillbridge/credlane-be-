import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AdminTiers } from '../../../common/decorators/admin-tiers.decorator';
import { Roles } from '../../../common/decorators/roles.decorator';
import { AdminTier, UserRole } from '../../users/entities/user.entity';
import { AdminPaymentsService } from './admin-payments.service';
import { ListSubscriptionsQueryDto } from './dto/list-subscriptions-query.dto';
import { ListTransactionsQueryDto } from './dto/list-transactions-query.dto';
import { RevenueChartQueryDto } from './dto/revenue-chart-query.dto';

const REVENUE_CHART_EXAMPLE = {
  employer_revenue: [
    { period: '2026-01-01T00:00:00.000Z', amount: 1200 },
    { period: '2026-02-01T00:00:00.000Z', amount: 980 },
  ],
  talent_revenue: [{ period: '2026-01-01T00:00:00.000Z', amount: 450 }],
};

@ApiTags('admin-payments')
@ApiBearerAuth()
@Roles(UserRole.ADMIN)
@AdminTiers(AdminTier.SUPER_ADMIN)
@Controller('admin/payments')
export class AdminPaymentsController {
  constructor(private readonly paymentsService: AdminPaymentsService) {}

  @Get('stats')
  @ApiOperation({
    summary:
      'Stat cards: total revenue, active subscriptions, failed payment count',
  })
  @ApiOkResponse({
    description:
      'Returns total_revenue (value + currency), active_employer_subscriptions, active_talent_subscriptions, failed_payment_count',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'success' },
        data: {
          type: 'object',
          properties: {
            total_revenue: {
              type: 'object',
              properties: {
                value: { type: 'number', example: 5499.99 },
                currency: { type: 'string', example: 'USD' },
              },
            },
            active_employer_subscriptions: { type: 'number', example: 12 },
            active_talent_subscriptions: { type: 'number', example: 45 },
            failed_payment_count: { type: 'number', example: 3 },
          },
        },
      },
    },
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT token' })
  @ApiForbiddenResponse({ description: 'User is not a SUPER_ADMIN admin' })
  async getStats() {
    const data = await this.paymentsService.getStats();
    return { status: 'success', data };
  }

  @Get('revenue-chart')
  @ApiOperation({
    summary: 'Revenue chart data split by employer/talent, with period toggle',
  })
  @ApiOkResponse({
    description:
      'Returns employer_revenue[] and talent_revenue[] arrays of { period, amount } objects, grouped by the selected period',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'success' },
        data: {
          type: 'object',
          example: REVENUE_CHART_EXAMPLE,
          properties: {
            employer_revenue: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  period: { type: 'string', format: 'date-time' },
                  amount: { type: 'number' },
                },
              },
            },
            talent_revenue: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  period: { type: 'string', format: 'date-time' },
                  amount: { type: 'number' },
                },
              },
            },
          },
        },
      },
    },
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT token' })
  @ApiForbiddenResponse({ description: 'User is not a SUPER_ADMIN admin' })
  async getRevenueChart(@Query() query: RevenueChartQueryDto) {
    const data = await this.paymentsService.getRevenueChart(query);
    return { status: 'success', data };
  }

  @Get('employer-packages')
  @ApiOperation({ summary: 'List employer packages (Free + Paid tiers)' })
  @ApiOkResponse({
    description:
      'Returns array of packages — each with id, name, price, offer_limit, features, is_free',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'success' },
        data: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', format: 'uuid' },
              name: { type: 'string', example: 'Free' },
              price: { type: 'number', example: 0 },
              offer_limit: { type: 'number', example: 2, nullable: true },
              features: { type: 'object', nullable: true, example: null },
              is_free: { type: 'boolean', example: true },
            },
          },
        },
      },
    },
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT token' })
  @ApiForbiddenResponse({ description: 'User is not a SUPER_ADMIN admin' })
  async getEmployerPackages() {
    const data = await this.paymentsService.getEmployerPackages();
    return { status: 'success', data };
  }

  @Get('subscriptions')
  @ApiOperation({
    summary: 'Subscriptions table — employer and talent, paginated',
  })
  @ApiOkResponse({
    description:
      'Paginated list of subscriptions — each with subscriber_name, type, package_tier, monthly_price, status, start_date, next_billing_date, days_left_in_grace',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'success' },
        data: {
          type: 'object',
          properties: {
            items: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string', format: 'uuid' },
                  subscriber_name: { type: 'string', example: 'Jane Doe' },
                  type: { type: 'string', enum: ['employer', 'talent'] },
                  package_tier: {
                    type: 'string',
                    nullable: true,
                    example: 'Free',
                  },
                  monthly_price: { type: 'number', nullable: true, example: 0 },
                  status: { type: 'string', example: 'active' },
                  start_date: { type: 'string', format: 'date-time' },
                  next_billing_date: {
                    type: 'string',
                    format: 'date-time',
                    nullable: true,
                  },
                  days_left_in_grace: {
                    type: 'number',
                    nullable: true,
                    example: null,
                  },
                },
              },
            },
            total: { type: 'number', example: 50 },
            page: { type: 'number', example: 1 },
            limit: { type: 'number', example: 20 },
            totalPages: { type: 'number', example: 3 },
          },
        },
      },
    },
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT token' })
  @ApiForbiddenResponse({ description: 'User is not a SUPER_ADMIN admin' })
  async getSubscriptions(@Query() query: ListSubscriptionsQueryDto) {
    const data = await this.paymentsService.getSubscriptions(query);
    return { status: 'success', data };
  }

  @Get('transactions')
  @ApiOperation({
    summary: 'Transactions table — paginated with status/date filters',
  })
  @ApiOkResponse({
    description:
      'Paginated list of transactions — each with subscriber_name, type, amount, currency, date, status, linked_subscription_id',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'success' },
        data: {
          type: 'object',
          properties: {
            items: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string', format: 'uuid' },
                  subscriber_name: { type: 'string', example: 'Acme Corp' },
                  type: { type: 'string', example: 'employer' },
                  amount: { type: 'number', example: 49.99 },
                  currency: { type: 'string', example: 'USD' },
                  date: { type: 'string', format: 'date-time' },
                  status: {
                    type: 'string',
                    enum: ['successful', 'failed', 'refunded'],
                  },
                  linked_subscription_id: {
                    type: 'string',
                    format: 'uuid',
                    nullable: true,
                  },
                },
              },
            },
            total: { type: 'number', example: 120 },
            page: { type: 'number', example: 1 },
            limit: { type: 'number', example: 20 },
            totalPages: { type: 'number', example: 6 },
          },
        },
      },
    },
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT token' })
  @ApiForbiddenResponse({ description: 'User is not a SUPER_ADMIN admin' })
  async getTransactions(@Query() query: ListTransactionsQueryDto) {
    const data = await this.paymentsService.getTransactions(query);
    return { status: 'success', data };
  }

  @Get('talent-subscriptions')
  @ApiOperation({
    summary: 'Talent subscription summary — active/cancelled counts and price',
  })
  @ApiOkResponse({
    description:
      'Returns total_active, total_cancelled counts and the monthly_price of the paid tier (null if not set)',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'success' },
        data: {
          type: 'object',
          properties: {
            total_active: { type: 'number', example: 45 },
            total_cancelled: { type: 'number', example: 8 },
            monthly_price: { type: 'number', nullable: true, example: 9.99 },
          },
        },
      },
    },
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT token' })
  @ApiForbiddenResponse({ description: 'User is not a SUPER_ADMIN admin' })
  async getTalentSubscriptionSummary() {
    const data = await this.paymentsService.getTalentSubscriptionSummary();
    return { status: 'success', data };
  }
}
