<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('departments', function (Blueprint $table) {
            $table->id();
            $table->string('name')->unique();
            $table->boolean('is_active')->default(true);
            $table->unsignedSmallInteger('sort_order')->default(0);
            $table->timestamps();
        });

        Schema::create('department_user', function (Blueprint $table) {
            $table->foreignId('department_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->primary(['department_id', 'user_id']);
        });

        Schema::create('complaint_types', function (Blueprint $table) {
            $table->id();
            $table->string('name')->unique();
            $table->boolean('is_active')->default(true);
            $table->unsignedSmallInteger('sort_order')->default(0);
            $table->timestamps();
        });

        Schema::create('couriers', function (Blueprint $table) {
            $table->id();
            $table->string('name')->unique();
            $table->boolean('is_active')->default(true);
            $table->unsignedSmallInteger('sort_order')->default(0);
            $table->timestamps();
        });

        Schema::create('priorities', function (Blueprint $table) {
            $table->id();
            $table->string('name')->unique();
            $table->unsignedSmallInteger('sla_hours')->default(48);
            $table->boolean('is_active')->default(true);
            $table->unsignedSmallInteger('sort_order')->default(0);
            $table->timestamps();
        });

        Schema::create('complaint_statuses', function (Blueprint $table) {
            $table->id();
            $table->string('name')->unique();
            $table->boolean('is_active')->default(true);
            $table->unsignedSmallInteger('sort_order')->default(0);
            $table->timestamps();
        });

        Schema::create('products', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('sku')->nullable();
            $table->string('category')->nullable();
            $table->text('description')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        Schema::create('complaints', function (Blueprint $table) {
            $table->id();
            $table->string('ticket_id')->unique();
            $table->string('customer_name');
            $table->string('customer_phone')->nullable();
            $table->string('order_number');
            $table->foreignId('product_id')->nullable()->constrained('products')->nullOnDelete();
            $table->unsignedInteger('quantity_affected')->nullable();
            $table->foreignId('complaint_type_id')->nullable()->constrained('complaint_types')->nullOnDelete();
            $table->text('description');
            $table->json('proof_files')->nullable();
            $table->foreignId('courier_id')->nullable()->constrained('couriers')->nullOnDelete();
            $table->string('tracking_number')->nullable();
            $table->string('replacement_tracking_number')->nullable();
            $table->foreignId('priority_id')->nullable()->constrained('priorities')->nullOnDelete();
            $table->foreignId('status_id')->nullable()->constrained('complaint_statuses')->nullOnDelete();
            $table->foreignId('assigned_department_id')->nullable()->constrained('departments')->nullOnDelete();
            $table->string('assigned_user')->nullable();
            $table->string('assigned_user_name')->nullable();
            $table->text('resolution_notes')->nullable();
            $table->timestamp('sla_deadline')->nullable();
            $table->timestamp('sla_paused_at')->nullable();
            $table->unsignedInteger('sla_paused_duration')->default(0);
            $table->timestamp('first_response_at')->nullable();
            $table->timestamp('resolved_at')->nullable();
            $table->timestamp('closed_at')->nullable();
            $table->timestamps();

            $table->index('customer_phone');
            $table->index('status_id');
            $table->index('created_at');
        });

        Schema::create('ticket_activities', function (Blueprint $table) {
            $table->id();
            $table->string('complaint_id');
            $table->string('action_type');
            $table->text('description');
            $table->string('old_value')->nullable();
            $table->string('new_value')->nullable();
            $table->string('user_email')->nullable();
            $table->string('user_name')->nullable();
            $table->timestamps();

            $table->index('complaint_id');
            $table->index('created_at');
        });

        Schema::create('internal_notes', function (Blueprint $table) {
            $table->id();
            $table->string('complaint_id');
            $table->text('content');
            $table->string('author_email')->nullable();
            $table->string('author_name')->nullable();
            $table->foreignId('department_id')->nullable()->constrained('departments')->nullOnDelete();
            $table->json('attachments')->nullable();
            $table->timestamps();

            $table->index('complaint_id');
        });

        Schema::create('notifications', function (Blueprint $table) {
            $table->id();
            $table->string('recipient_email');
            $table->string('title');
            $table->text('message');
            $table->string('type');
            $table->string('complaint_id')->nullable();
            $table->boolean('is_read')->default(false);
            $table->timestamps();

            $table->index(['recipient_email', 'is_read']);
        });

        Schema::create('roles', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->text('description')->nullable();
            $table->json('permissions')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        Schema::create('system_configs', function (Blueprint $table) {
            $table->id();
            $table->string('key')->unique();
            $table->string('label')->nullable();
            $table->json('value')->nullable();
            $table->json('json_value')->nullable();
            $table->timestamps();
        });

        Schema::create('oms_configs', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('base_url');
            $table->text('api_key');
            $table->string('auth_type')->default('bearer');
            $table->string('auth_header_name')->nullable();
            $table->string('update_order_endpoint');
            $table->json('status_mapping')->nullable();
            $table->boolean('is_active')->default(false);
            $table->text('last_test_result')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('oms_configs');
        Schema::dropIfExists('system_configs');
        Schema::dropIfExists('roles');
        Schema::dropIfExists('notifications');
        Schema::dropIfExists('internal_notes');
        Schema::dropIfExists('ticket_activities');
        Schema::dropIfExists('complaints');
        Schema::dropIfExists('products');
        Schema::dropIfExists('complaint_statuses');
        Schema::dropIfExists('priorities');
        Schema::dropIfExists('couriers');
        Schema::dropIfExists('complaint_types');
        Schema::dropIfExists('department_user');
        Schema::dropIfExists('departments');
    }
};
