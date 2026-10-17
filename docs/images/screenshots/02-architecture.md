# Architecture & Design Decisions

This document explains the "why" behind the technical structure of the Library BTP project. It is designed to give a reviewer a clear mental model of how data and requests flow through the system.

## 1. High-Level Architecture

The application is built on a **monorepo** structure using the **SAP Cloud Application Programming Model (CAP)**, deployed to **SAP BTP (Cloud Foundry)**.

```mermaid
flowchart TB
    subgraph Browser["🌐 Browser"]
        FE1["📘 list_object_library<br/>(Fiori Elements)"]
        FE2["📕 loan-management<br/>(Fiori Elements)"]
        FE3["📊 library-analytics<br/>(Fiori Elements)"]
        FE4["🔔 notifications-ui<br/>(Fiori Elements)"]
    end

    subgraph BTP["☁️ SAP BTP - Cloud Foundry"]
        SRV["⚙️ Library-srv<br/>CAP Node.js Runtime"]
        XSUAA["🔐 XSUAA<br/>Authentication & Roles"]
        HDI["💾 Library-db<br/>HANA HDI Container"]
        ANS["📮 Library-ANS<br/>Alert Notification"]
    end

    subgraph CPI["🔄 Integration Suite (Separate)"]
        IFLOW["Book Enricher<br/>(Google Books API)"]
    end

    FE1 & FE2 & FE3 & FE4 -->|OData V4| SRV
    SRV -->|JWT Validation| XSUAA
    SRV -->|SQL / CDS Queries| HDI
    SRV -->|cds.emit Events| SRV
    SRV -->|OAuth2| ANS
    SRV -.->|Outbound API Call| IFLOW   