import classes from './Logo.module.css'
import React from 'react'

const Logo = () => {
    return (
        <div className={classes.logo}>
            <div style={{color:'#4285f4'}} className={classes.font}>G</div>
            <div style={{color:'#ea4335'}} className={classes.font}>o</div>
            <div style={{color:'#fbbc05'}} className={classes.font}>o</div>
            <div style={{color:'#4285f4'}} className={classes.font}>g</div>
            <div style={{color:'#34a853'}} className={classes.font}>l</div>
            <div style={{color:'#ea4335'}} className={classes.font}>e</div>
        </div>
    )
}

export default Logo
