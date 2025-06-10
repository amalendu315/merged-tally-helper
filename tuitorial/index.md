# Tutorial: merged-tally-helper

This project is a web application built with Next.js 14 that helps users
**manage and sync financial voucher data** from a Microsoft SQL Server
database to various **Tally Cloud APIs**. It includes user **authentication**,
**regional access control**, features to **fetch, filter, and export** voucher
data, track sync history, and display **upload progress**.


## Visual Overview

```mermaid
flowchart TD
    A0["Authentication System"]
    A7["Regional Routing & Access Control"]
    A1["Database Access"]
    A2["External API Integration"]
    A3["Voucher Data Logic"]
    A4["Voucher Sync Logging"]
    A5["Voucher Selection State"]
    A6["User Interface (ShadCN/Tailwind)"]
    A8["Upload Progress Modal"]
    A9["Environment Configuration"]
    A0 -- "Authenticates user" --> A7
    A0 -- "Reads secret" --> A9
    A7 -- "Checks user region" --> A3
    A7 -- "Renders pages" --> A6
    A1 -- "Reads credentials" --> A9
    A4 -- "Stores/Retrieves logs" --> A1
    A2 -- "Reads endpoints/tokens" --> A9
    A2 -- "Fetches raw data" --> A1
    A3 -- "Fetches & Pushes data" --> A2
    A3 -- "Manages selected vouchers" --> A5
    A3 -- "Records sync history" --> A4
    A3 -- "Displays push status" --> A8
    A3 -- "Renders controls" --> A6
    A6 -- "Displays/Updates selection" --> A5
    A8 -- "Uses UI components" --> A6

## Chapters

1. [Environment Configuration
](01_environment_configuration_.md)
2. [Voucher Selection State
](02_voucher_selection_state_.md)
3. [Database Access
](03_database_access_.md)
4. [Authentication System
](04_authentication_system_.md)
5. [External API Integration
](05_external_api_integration_.md)
6. [Voucher Sync Logging
](06_voucher_sync_logging_.md)
7. [User Interface (ShadCN/Tailwind)
](07_user_interface__shadcn_tailwind__.md)
8. [Upload Progress Modal
](08_upload_progress_modal_.md)
9. [Regional Routing & Access Control
](09_regional_routing___access_control_.md)
10. [Voucher Data Logic
](10_voucher_data_logic_.md)

---
