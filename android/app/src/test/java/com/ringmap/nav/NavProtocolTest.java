package com.ringmap.nav;

import static org.junit.Assert.assertTrue;

import org.junit.Test;

public class NavProtocolTest {
    @Test
    public void authorityRevisionIsStrictlyMonotonic() {
        long first = NavProtocol.nextRevision();
        long second = NavProtocol.nextRevision();
        assertTrue(second > first);
    }
}
