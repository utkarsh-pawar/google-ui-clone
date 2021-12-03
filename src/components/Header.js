import React from 'react'
import classes from './Header.module.css'
import { IoApps } from 'react-icons/io5'
import { FaUserCircle } from 'react-icons/fa'

const Header = () => {
    return (
        <nav className={classes.navbar}>
            <div className={classes['link-div']}>

                <a className={classes.link} href="https://mail.google.com">Gmail</a>
            </div>
            <div className={classes['link-div']}>
                <a className={classes.link} href="https://images.google.com">Images</a>
            </div>
            
            <div className={classes.app}>

                <IoApps style={{ 'font-size': '1.25rem', 'padding': '0.5rem', 'color': 'rgba(0,0,0,0.5)' }} ></IoApps>
            </div>

            <div className={classes.profile}>
                <FaUserCircle style={{ 'font-size': '2rem', 'padding': '0.2rem', 'color': 'rgba(0,0,0,0.87)' }}></FaUserCircle>
            </div>


        </nav >
    )
}

export default Header
